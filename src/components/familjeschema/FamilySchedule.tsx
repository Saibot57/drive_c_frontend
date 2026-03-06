'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Home,
  Plus,
  ArrowRightLeft,
  Printer,
  Settings as SettingsIcon,
  Grid3x3,
  Layers,
  Users,
  MoreVertical,
} from 'lucide-react';
import { FeatureNavigation } from '@/components/FeatureNavigation';
import { scheduleService } from '@/services/scheduleService';
import type {
  Activity,
  FamilyMember,
  FormData,
  Settings,
  CreateActivityPayload,
} from './types';
import type { ActivityImportItem } from '@/types/schedule';
import { WEEKDAYS_FULL, ALL_DAYS, DEFAULT_SETTINGS } from './constants';
import { getWeekNumber, getWeekDateRange, isWeekInPast, isWeekInFuture } from './utils/dateUtils';
import { generateTimeSlots } from './utils/scheduleUtils';
import { downloadAllICS } from './utils/exportUtils';
import { useFocusTrap } from './hooks/useFocusTrap';
import { normalizeActivitiesForBackend } from '@/utils/normalizeActivities';

import { Sidebar } from './components/Sidebar';
import { WeekPicker } from './components/WeekPicker';
import { ScheduleGrid } from './components/ScheduleGrid';
import { LayerView } from './components/LayerView';
import { ActivityModal } from './components/ActivityModal';
import { SettingsModal } from './components/SettingsModal';
import { DataModal } from './components/DataModal';
import { Emoji } from '@/utils/Emoji';

const BLANK_FORM: FormData = {
  name: '', icon: '🎯', days: [], participants: [], startTime: '09:00',
  endTime: '10:00', location: '', notes: '', recurring: false,
  recurringEndDate: '', color: undefined
};

type ViewMode = 'grid' | 'layer';

export function FamilySchedule() {
  const modalRef = useRef<HTMLDivElement>(null);
  const settingsModalRef = useRef<HTMLDivElement>(null);
  const originalMemberOrderRef = useRef<FamilyMember[]>([]);
  const scheduleRef = useRef<HTMLDivElement>(null);

  const [activities, setActivities] = useState<Activity[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [isReorderingMembers, setIsReorderingMembers] = useState(false);
  const [isSavingMemberOrder, setIsSavingMemberOrder] = useState(false);
  const [settings, setSettings] = useState<Settings>({ ...DEFAULT_SETTINGS });
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedWeek, setSelectedWeek] = useState(getWeekNumber(new Date()));
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [modalOpen, setModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [showWeekPicker, setShowWeekPicker] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dataModalOpen, setDataModalOpen] = useState(false);
  const [formData, setFormData] = useState<FormData>(BLANK_FORM);
  const [highlightedMemberId, setHighlightedMemberId] = useState<string | null>(null);
  const [showConflict, setShowConflict] = useState(false);
  const [memberFormOpen, setMemberFormOpen] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);
  const [mobileSelectedDayIndex, setMobileSelectedDayIndex] = useState(0);
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [aiPreviewActivities, setAiPreviewActivities] = useState<ActivityImportItem[]>([]);
  const [aiImporting, setAiImporting] = useState(false);
  const [aiImportError, setAiImportError] = useState<string | null>(null);

  const normalizeSettings = (incoming?: Partial<Settings> | null): Settings => {
    const candidate: Partial<Settings> = incoming ?? {};
    const printPageSize = candidate.printPageSize === 'a3' ? 'a3' : DEFAULT_SETTINGS.printPageSize;
    return {
      ...DEFAULT_SETTINGS,
      ...candidate,
      printPageSize,
    };
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(max-width: 1023px)');
    setIsMobileView(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobileView(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!modalOpen) return;
    if (editingActivity) {
      setFormData({
        ...editingActivity,
        days: [editingActivity.day],
        recurring: false,
        recurringEndDate: '',
        location: editingActivity.location || '',
        notes: editingActivity.notes || '',
        color: editingActivity.color
      });
    } else {
      setFormData(BLANK_FORM);
    }
  }, [modalOpen, editingActivity]);

  const participantLookup = useMemo(() => {
    const lookup: Record<string, string> = {};
    familyMembers.forEach(member => {
      lookup[member.name.toLowerCase()] = member.id;
    });
    return lookup;
  }, [familyMembers]);

  const participantIdSet = useMemo(() => new Set(familyMembers.map(member => member.id)), [familyMembers]);

  const mapParticipantsForImport = (items: ActivityImportItem[]): ActivityImportItem[] =>
    items.map(item => {
      const mappedParticipants = item.participants.map(participant => {
        const trimmed = participant.trim();
        if (!trimmed) return trimmed;
        if (participantIdSet.has(trimmed)) return trimmed;
        const lookupKey = trimmed.toLowerCase();
        return participantLookup[lookupKey] ?? trimmed;
      });

      return { ...item, participants: mappedParticipants };
    });

  const handleAIPreview = (activities: ActivityImportItem[]) => {
    setAiPreviewActivities(activities);
    setAiImportError(null);
  };

  const handleCloseDataModal = () => {
    setDataModalOpen(false);
    setAiPreviewActivities([]);
    setAiImportError(null);
    setAiImporting(false);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [activitiesData, membersData, settingsData] = await Promise.all([
        scheduleService.getActivities(selectedYear, selectedWeek),
        scheduleService.getFamilyMembers(),
        scheduleService.getSettings()
      ]);
      setActivities(activitiesData);
      setFamilyMembers(membersData);
      if (settingsData) setSettings(normalizeSettings(settingsData));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte hämta schemadata.');
    } finally {
      setLoading(false);
    }
  };

  useFocusTrap(modalRef, modalOpen);
  useFocusTrap(settingsModalRef, settingsOpen);

  const handleSaveActivity = async (activityFromForm: FormData, applyToSeries = false) => {
    try {
      const payload: CreateActivityPayload = {
        name: activityFromForm.name,
        icon: activityFromForm.icon,
        days: activityFromForm.days,
        participants: activityFromForm.participants,
        startTime: activityFromForm.startTime,
        endTime: activityFromForm.endTime,
        location: activityFromForm.location || undefined,
        notes: activityFromForm.notes || undefined,
        recurring: activityFromForm.recurring,
        color: activityFromForm.color,
        week: selectedWeek,
        year: selectedYear,
      };

      if (activityFromForm.recurring) {
        if (activityFromForm.recurringEndDate) {
          payload.recurringEndDate = activityFromForm.recurringEndDate;
        }
      } else {
        delete payload.recurringEndDate;

        if (editingActivity?.seriesId && !applyToSeries) {
          delete payload.recurring;
        }
      }

      if (editingActivity) {
        if (applyToSeries && editingActivity.seriesId) {
          const updatedActivities = await scheduleService.updateActivitySeries(editingActivity.seriesId, payload);
          setActivities(prev =>
            prev.map(a => updatedActivities.find(u => u.id === a.id) || a)
          );
        } else {
          const updatedActivity = await scheduleService.updateActivity(editingActivity.id, payload);
          setActivities(prev => prev.map(a => (a.id === updatedActivity.id ? updatedActivity : a)));
        }
      } else {
        const created = await scheduleService.createActivity(payload);
        setActivities(prev => [...prev, ...created]);
      }

      setModalOpen(false);
      setEditingActivity(null);
    } catch (error) {
      console.error('Error saving activity:', error);
    }
  };

  const handleDeleteActivity = async (applyToSeries = false) => {
    if (!editingActivity) return;
    try {
      if (applyToSeries && editingActivity.seriesId) {
        await scheduleService.deleteActivitySeries(editingActivity.seriesId);
        setActivities(prev => prev.filter(a => a.seriesId !== editingActivity.seriesId));
      } else {
        await scheduleService.deleteActivity(editingActivity.id);
        setActivities(prev => prev.filter(a => a.id !== editingActivity.id));
      }
      setModalOpen(false);
      setEditingActivity(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte ta bort aktivitet.');
    }
  };

  const handleSettingsChange = async (newSettings: Settings) => {
    try {
      const payload = normalizeSettings(newSettings);
      const updatedSettings = await scheduleService.updateSettings(payload);
      setSettings(normalizeSettings(updatedSettings));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte spara inställningar.');
    }
  };

  const handleSaveMember = async (memberData: { name: string; color: string; icon: string }) => {
    if (editingMember) {
      const previous = [...familyMembers];
      setFamilyMembers(prev => prev.map(m => m.id === editingMember.id ? { ...m, ...memberData } : m));
      try {
        const updated = await scheduleService.updateFamilyMember(editingMember.id, memberData);
        setFamilyMembers(prev => prev.map(m => m.id === editingMember.id ? updated : m));
      } catch (err) {
        setFamilyMembers(previous);
        setError(err instanceof Error ? err.message : 'Kunde inte uppdatera medlem.');
      }
    } else {
      const tempId = `temp-${Date.now()}`;
      const newMember = { id: tempId, ...memberData };
      setFamilyMembers(prev => [...prev, newMember]);
      try {
        const created = await scheduleService.createFamilyMember(memberData);
        setFamilyMembers(prev => prev.map(m => m.id === tempId ? created : m));
      } catch (err) {
        setFamilyMembers(prev => prev.filter(m => m.id !== tempId));
        setError(err instanceof Error ? err.message : 'Kunde inte skapa medlem.');
      }
    }
    setEditingMember(null);
    setMemberFormOpen(false);
  };

  const handleDeleteMember = async (member: FamilyMember) => {
    const previous = [...familyMembers];
    setFamilyMembers(prev => prev.filter(m => m.id !== member.id));
    try {
      await scheduleService.deleteFamilyMember(member.id);
      // Also remove this member from activities locally
      setActivities(prev => prev.map(a => ({
        ...a,
        participants: a.participants?.filter(p => p !== member.id && p !== member.name) ?? a.participants
      })));
    } catch (err) {
      setFamilyMembers(previous);
      setError(err instanceof Error ? err.message : 'Kunde inte ta bort medlem.');
    }
  };

  const handleStartMemberReorder = () => {
    if (familyMembers.length < 2) return;
    originalMemberOrderRef.current = [...familyMembers];
    setIsReorderingMembers(true);
  };

  const handleReorderMembers = (sourceId: string, targetId: string | null) => {
    if (!isReorderingMembers || sourceId === targetId) return;

    setFamilyMembers(prev => {
      const movingMember = prev.find(member => member.id === sourceId);
      if (!movingMember) return prev;

      const membersWithoutSource = prev.filter(member => member.id !== sourceId);

      if (targetId === null) {
        return [...membersWithoutSource, movingMember];
      }

      const targetIndex = membersWithoutSource.findIndex(member => member.id === targetId);
      if (targetIndex === -1) {
        return prev;
      }

      const updated = [...membersWithoutSource];
      updated.splice(targetIndex, 0, movingMember);
      return updated;
    });
  };

  const handleSubmitMemberReorder = () => {
    if (!isReorderingMembers) return;

    const previousOrder = [...originalMemberOrderRef.current];
    const newOrderIds = familyMembers.map(member => member.id);
    const originalIds = previousOrder.map(member => member.id);
    const hasChanges =
      newOrderIds.length !== originalIds.length ||
      newOrderIds.some((id, index) => id !== originalIds[index]);

    // Optimistic: confirm immediately
    setIsReorderingMembers(false);
    originalMemberOrderRef.current = [];

    if (!hasChanges) return;

    // Save in background
    scheduleService.reorderFamilyMembers(newOrderIds)
      .then(updatedMembers => {
        if (Array.isArray(updatedMembers) && updatedMembers.length > 0) {
          setFamilyMembers(updatedMembers);
        }
      })
      .catch(err => {
        console.error('Failed to reorder family members', err);
        setFamilyMembers(previousOrder);
        setError(err instanceof Error ? err.message : 'Kunde inte spara ordningen. Försök igen.');
      });
  };

  const handleTextImport = async (jsonText: string) => {
    try {
      const importedData = JSON.parse(jsonText);
      if (!Array.isArray(importedData)) throw new Error('JSON måste vara en array.');

      const { ok, errors } = normalizeActivitiesForBackend(importedData, selectedWeek, selectedYear);
      if (!ok.length) {
        const firstError = errors[0]?.message || 'JSON innehöll inga giltiga aktiviteter.';
        throw new Error(firstError);
      }

      const prepared = mapParticipantsForImport(ok);
      await scheduleService.addActivitiesFromJson(prepared);
      await fetchActivities(selectedYear, selectedWeek);
      handleCloseDataModal();

      const errorSummary = errors.length
        ? `\n\nHoppar över ${errors.length} rader:\n${errors
            .map(error => `Rad ${error.index + 1}: ${error.message}`)
            .join('\n')}`
        : '';
      alert(`${prepared.length} aktiviteter importerades!${errorSummary}`);
    } catch (err: any) {
      const errorMessage = err?.details
        ? `${err.message}\n\nKonflikter:\n${JSON.stringify(err.details, null, 2)}`
        : err?.message || 'Okänt fel';
      alert(`Import misslyckades: ${errorMessage}`);
    }
  };

  const handleAIImport = async () => {
    if (!aiPreviewActivities.length) return;
    try {
      setAiImporting(true);
      setAiImportError(null);
      const prepared = aiPreviewActivities.map(activity => ({
        ...activity,
        participants: [...activity.participants],
        days: [...activity.days],
      }));
      await scheduleService.addActivitiesFromJson(prepared);
      await fetchActivities(selectedYear, selectedWeek);
      handleCloseDataModal();
      alert(`${prepared.length} aktiviteter importerades!`);
    } catch (err: any) {
      const errorMessage = err?.details
        ? `${err.message}\n\nKonflikter:\n${JSON.stringify(err.details, null, 2)}`
        : err?.message || 'Import misslyckades.';
      setAiImportError(errorMessage);
    } finally {
      setAiImporting(false);
    }
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) handleTextImport(text);
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleExportJSON = () => {
    const jsonString = JSON.stringify(activities, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'familjens-schema-export.json';
    a.click();
    URL.revokeObjectURL(url);
    handleCloseDataModal();
  };

  const handleExportICS = () => {
    downloadAllICS(activities);
    handleCloseDataModal();
  };

  const fetchActivities = async (year: number, week: number) => {
    try {
      setLoading(true);
      const fetchedActivities = await scheduleService.getActivities(year, week);
      setActivities(fetchedActivities);
    } catch (error) {
      console.error("Failed to fetch activities for new week", error);
    } finally {
      setLoading(false);
    }
  };

  const currentWeek = getWeekNumber(new Date());
  const currentYear = new Date().getFullYear();
  const isCurrentWeek = selectedWeek === currentWeek && selectedYear === currentYear;
  const days = settings.showWeekends ? ALL_DAYS : WEEKDAYS_FULL;
  const timeSlots = generateTimeSlots(settings.dayStart, settings.dayEnd);
  const weekDates = getWeekDateRange(selectedWeek, selectedYear, days.length);
  const printSheetClass = settings.printPageSize === 'a3' ? 'print-sheet-a3' : 'print-sheet-a4';
  const navigateWeek = (direction: number) => {
    const monday = getWeekDateRange(selectedWeek, selectedYear, 1)[0];
    monday.setDate(monday.getDate() + direction * 7);
    const newWeek = getWeekNumber(monday);
    const newYear = monday.getFullYear();
    setSelectedWeek(newWeek);
    setSelectedYear(newYear);
    fetchActivities(newYear, newWeek);
  };

  const goToCurrentWeek = () => {
    setSelectedWeek(currentWeek);
    setSelectedYear(currentYear);
    fetchActivities(currentYear, currentWeek);
  };

  const handleActivityClick = (activity: Activity) => {
    setEditingActivity(activity);
    setModalOpen(true);
  };

  const handleMemberClick = (memberId: string) => {
    setViewMode('layer');
    setHighlightedMemberId(memberId);
  };

  // Mobile day navigation
  const mobileSelectedDay = days[mobileSelectedDayIndex] ?? days[0];
  const isAtFirstMobileDay = mobileSelectedDayIndex === 0;
  const isAtLastMobileDay = mobileSelectedDayIndex === days.length - 1;
  const mobileDayDate = weekDates[mobileSelectedDayIndex];

  const handleSystemPrint = () => {
    const scheduleElement = scheduleRef.current;

    if (!scheduleElement) {
      window.print();
      return;
    }

    const originalTransform = scheduleElement.style.transform;
    const originalTransformOrigin = scheduleElement.style.transformOrigin;
    const originalWidth = scheduleElement.style.width;
    const originalHeight = scheduleElement.style.height;

    const marginBuffer = 8;

    let cachedPxPerMM: number | null = null;

    const measurePxPerMM = () => {
      if (cachedPxPerMM !== null) return cachedPxPerMM;
      const testElement = document.createElement('div');
      testElement.style.width = '1mm';
      testElement.style.height = '1mm';
      testElement.style.position = 'absolute';
      testElement.style.visibility = 'hidden';
      testElement.style.pointerEvents = 'none';
      document.body.appendChild(testElement);
      const rect = testElement.getBoundingClientRect();
      document.body.removeChild(testElement);
      if (rect.width) {
        cachedPxPerMM = rect.width;
        return cachedPxPerMM;
      }
      return null;
    };

    const parseMillimeters = (value: string) => {
      if (!value) return null;
      const numeric = Number.parseFloat(value);
      return Number.isFinite(numeric) ? numeric : null;
    };

    const getPrintableDimensions = () => {
      const styles = window.getComputedStyle(scheduleElement);
      const widthMM = parseMillimeters(styles.getPropertyValue('--print-usable-width-mm'));
      const heightMM = parseMillimeters(styles.getPropertyValue('--print-usable-height-mm'));
      if (widthMM == null || heightMM == null) return null;
      const pxPerMM = measurePxPerMM();
      if (!pxPerMM) return null;
      return {
        width: widthMM * pxPerMM,
        height: heightMM * pxPerMM,
      };
    };

    const applyScale = () => {
      const contentWidth = scheduleElement.scrollWidth;
      const contentHeight = scheduleElement.scrollHeight;

      if (!contentWidth || !contentHeight) return;

      let availableWidth = Math.max(window.innerWidth - marginBuffer, 0);
      let availableHeight = Math.max(window.innerHeight - marginBuffer, 0);

      const printableDimensions = getPrintableDimensions();
      if (printableDimensions) {
        availableWidth = printableDimensions.width;
        availableHeight = printableDimensions.height;
      }

      if (!availableWidth || !availableHeight) return;

      const scale = Math.min(availableWidth / contentWidth, availableHeight / contentHeight, 1);

      scheduleElement.style.transform = `scale(${scale})`;
      scheduleElement.style.transformOrigin = 'top left';
      scheduleElement.style.width = `${contentWidth}px`;
      scheduleElement.style.height = `${contentHeight}px`;
    };

    const removeMediaListener = () => {
      if (mediaQueryList?.removeEventListener) {
        mediaQueryList.removeEventListener('change', handleMediaChange);
      } else if (mediaQueryList?.removeListener) {
        mediaQueryList.removeListener(handleMediaChange);
      }
    };

    const cleanup = () => {
      scheduleElement.classList.remove('print-scaling');
      scheduleElement.style.transform = originalTransform;
      scheduleElement.style.transformOrigin = originalTransformOrigin;
      scheduleElement.style.width = originalWidth;
      scheduleElement.style.height = originalHeight;
      window.removeEventListener('resize', applyScale);
      removeMediaListener();
    };

    const handlePrintEnd = () => {
      cleanup();
      window.removeEventListener('afterprint', handlePrintEnd);
    };

    const mediaQueryList = window.matchMedia?.('print');

    const handleMediaChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        scheduleElement.classList.add('print-scaling');
        applyScale();
      } else {
        cleanup();
      }
    };

    if (mediaQueryList?.addEventListener) {
      mediaQueryList.addEventListener('change', handleMediaChange);
    } else if (mediaQueryList?.addListener) {
      mediaQueryList?.addListener(handleMediaChange);
    }

    scheduleElement.classList.add('print-scaling');
    applyScale();

    window.addEventListener('resize', applyScale);
    window.addEventListener('afterprint', handlePrintEnd);

    window.print();

    window.setTimeout(() => {
      cleanup();
      window.removeEventListener('afterprint', handlePrintEnd);
    }, 1000);
  };

  if (loading) return <div className="text-center p-10 font-monument">Laddar schema...</div>;
  if (error) return <div className="text-center p-10 font-monument text-red-600">Fel: {error}</div>;

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">

      {/* ── Child A: Toolbar + Workspace ─────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-4 lg:space-y-6">

        {/* ── Desktop Top Toolbar ──────────────────────────────────────── */}
        <div className="hidden lg:flex rounded-xl border-2 border-black bg-white p-4 shadow-[4px_4px_0px_rgba(0,0,0,1)] items-center gap-4">

          {/* LEFT – Feature switcher */}
          <FeatureNavigation />

          {/* CENTER – Week navigation */}
          <div className="flex items-center gap-1 mx-auto relative">
            <button
              className="btn-compact btn-icon-small"
              onClick={() => navigateWeek(-1)}
              aria-label="Föregående vecka"
              title="Föregående vecka"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              className="week-display px-3 py-1 font-monument text-sm tracking-widest hover:bg-black/5 rounded transition-colors"
              onClick={() => setShowWeekPicker(!showWeekPicker)}
              title="Välj vecka"
              aria-label="Välj vecka"
            >
              Vecka {selectedWeek}
            </button>
            <button
              className="btn-compact btn-icon-small"
              onClick={() => navigateWeek(1)}
              aria-label="Nästa vecka"
              title="Nästa vecka"
            >
              <ChevronRight size={18} />
            </button>
            {!isCurrentWeek && (
              <button
                className="btn-compact ml-1 flex items-center gap-1"
                onClick={goToCurrentWeek}
                title="Gå till nuvarande vecka"
                aria-label="Denna vecka"
              >
                <Home size={15} />
                <span className="text-xs">Denna vecka</span>
              </button>
            )}
          </div>

          {/* RIGHT – View mode toggles */}
          <div className="flex items-center gap-1 ml-auto">
            <button
              className={`btn-square ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Rutnätsvy"
              aria-label="Rutnätsvy"
              aria-pressed={viewMode === 'grid'}
              type="button"
            >
              <Grid3x3 size={18} />
            </button>
            <button
              className={`btn-square ${viewMode === 'layer' ? 'active' : ''}`}
              onClick={() => setViewMode('layer')}
              title="Lagervy"
              aria-label="Lagervy"
              aria-pressed={viewMode === 'layer'}
              type="button"
            >
              <Layers size={18} />
            </button>
          </div>
        </div>

        {/* ── Mobile Top Toolbar ───────────────────────────────────────── */}
        <div className="lg:hidden rounded-xl border-2 border-black bg-white shadow-[4px_4px_0px_rgba(0,0,0,1)] overflow-hidden">
          {/* Row 1: Feature nav + Week nav + Actions */}
          <div className="flex items-center gap-2 px-3 py-2">
            <FeatureNavigation />
            <div className="flex items-center gap-1 mx-auto">
              <button
                className="btn-compact btn-icon-small"
                onClick={() => navigateWeek(-1)}
                aria-label="Föregående vecka"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                className="week-display px-2 py-0.5 font-monument text-xs tracking-widest hover:bg-black/5 rounded transition-colors"
                onClick={() => setShowWeekPicker(!showWeekPicker)}
                aria-label="Välj vecka"
              >
                V{selectedWeek}
              </button>
              <button
                className="btn-compact btn-icon-small"
                onClick={() => navigateWeek(1)}
                aria-label="Nästa vecka"
              >
                <ChevronRight size={16} />
              </button>
              {!isCurrentWeek && (
                <button
                  className="btn-compact btn-icon-small ml-1"
                  onClick={goToCurrentWeek}
                  aria-label="Denna vecka"
                >
                  <Home size={14} />
                </button>
              )}
            </div>
            {/* Mobile actions menu */}
            <div className="relative">
              <button
                className="btn-compact btn-icon-small"
                onClick={() => setMobileActionsOpen(!mobileActionsOpen)}
                aria-label="Åtgärder"
                type="button"
              >
                <MoreVertical size={18} />
              </button>
              {mobileActionsOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMobileActionsOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-lg border-2 border-black bg-white shadow-[4px_4px_0px_rgba(0,0,0,1)] py-1">
                    <button
                      className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-black/5"
                      onClick={() => { setEditingActivity(null); setModalOpen(true); setMobileActionsOpen(false); }}
                      type="button"
                    >
                      <Plus size={15} /> Ny aktivitet
                    </button>
                    <button
                      className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-black/5"
                      onClick={() => { setDataModalOpen(true); setMobileActionsOpen(false); }}
                      type="button"
                    >
                      <ArrowRightLeft size={15} /> Import / Export
                    </button>
                    <button
                      className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-black/5"
                      onClick={() => { setSettingsOpen(true); setMobileActionsOpen(false); }}
                      type="button"
                    >
                      <SettingsIcon size={15} /> Inställningar
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Row 2: Family members horizontal strip */}
          {familyMembers.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 border-t border-gray-200 overflow-x-auto">
              {familyMembers.map(member => (
                <button
                  key={member.id}
                  type="button"
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg border-2 text-xs font-bold whitespace-nowrap transition-colors ${
                    highlightedMemberId === member.id
                      ? 'border-black bg-black/10'
                      : 'border-transparent hover:bg-black/5'
                  }`}
                  style={{ borderLeftColor: member.color, borderLeftWidth: 3 }}
                  onClick={() => handleMemberClick(member.id)}
                >
                  <Emoji emoji={member.icon} />
                  <span>{member.name}</span>
                </button>
              ))}
            </div>
          )}

          {/* Row 3: Day navigation */}
          <div className="flex items-center justify-between gap-2 border-t border-gray-200 px-3 py-1.5">
            <button
              className="btn-compact btn-icon-small"
              onClick={() => setMobileSelectedDayIndex(prev => Math.max(0, prev - 1))}
              disabled={isAtFirstMobileDay}
              aria-label="Föregående dag"
              type="button"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-bold">
              {mobileSelectedDay}
              {mobileDayDate && (
                <span className="text-gray-500 font-normal ml-1">
                  {mobileDayDate.getDate()}/{mobileDayDate.getMonth() + 1}
                </span>
              )}
            </span>
            <button
              className="btn-compact btn-icon-small"
              onClick={() => setMobileSelectedDayIndex(prev => Math.min(days.length - 1, prev + 1))}
              disabled={isAtLastMobileDay}
              aria-label="Nästa dag"
              type="button"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* ── Workspace row ─────────────────────────────────────────────── */}
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 h-[calc(100vh-14rem)] lg:h-[calc(100vh-10rem)]">

          {/* Left Sidebar — family members (desktop only) */}
          <div className="hidden lg:block">
            <Sidebar
              familyMembers={familyMembers}
              isReorderingMembers={isReorderingMembers}
              isSavingMemberOrder={isSavingMemberOrder}
              onMemberClick={handleMemberClick}
              onStartReorder={handleStartMemberReorder}
              onSubmitReorder={handleSubmitMemberReorder}
              onReorderMembers={handleReorderMembers}
              onQuickTextImport={handleTextImport}
            />
          </div>

          {/* Center — schedule grid */}
          <div className="flex-1 min-w-0 rounded-xl border-2 border-black bg-white shadow-[4px_4px_0px_rgba(0,0,0,1)] overflow-auto flex flex-col">
            {/* Notifications */}
            {!isCurrentWeek && (
              <div className="compact-notice" role="alert">
                <AlertCircle size={18}/>
                <span>Du tittar på {isWeekInPast(weekDates) ? 'en tidigare' : isWeekInFuture(weekDates) ? 'en kommande' : 'en annan'} vecka</span>
              </div>
            )}
            {showConflict && (
              <div className="compact-notice conflict" role="alert">
                <AlertCircle size={18}/>
                <span>Tidskonflikt! En deltagare är redan upptagen.</span>
              </div>
            )}

            {/* Schedule view */}
            <div
              className={`schedule-view-container printable-schedule-scope ${printSheetClass} flex-1`}
              ref={scheduleRef}
            >
              {viewMode === 'grid' ? (
                <ScheduleGrid
                  days={days} weekDates={weekDates} timeSlots={timeSlots}
                  activities={activities} familyMembers={familyMembers}
                  settings={settings} selectedWeek={selectedWeek}
                  selectedYear={selectedYear} onActivityClick={handleActivityClick}
                  mobileSelectedDay={isMobileView ? mobileSelectedDay : undefined}
                />
              ) : (
                <LayerView
                  days={days} weekDates={weekDates} timeSlots={timeSlots}
                  activities={activities} familyMembers={familyMembers}
                  settings={settings} selectedWeek={selectedWeek}
                  selectedYear={selectedYear} onActivityClick={handleActivityClick}
                  highlightedMemberId={highlightedMemberId}
                  mobileSelectedDay={isMobileView ? mobileSelectedDay : undefined}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Right Sidebar: Actions (desktop only) ─────────────────────── */}
      <div className="hidden lg:flex w-[200px] rounded-xl border-2 border-black bg-white shadow-[4px_4px_0px_rgba(0,0,0,1)] flex-col shrink-0 p-4 gap-3">
        <h3 className="font-bold text-xs uppercase tracking-widest mb-1">Åtgärder</h3>

        <button
          className="btn-compact btn-primary w-full flex items-center gap-2"
          onClick={() => { setEditingActivity(null); setModalOpen(true); }}
          title="Ny aktivitet"
          type="button"
        >
          <Plus size={15} />
          <span>Ny aktivitet</span>
        </button>

        <button
          className="btn-compact w-full flex items-center gap-2"
          onClick={() => setDataModalOpen(true)}
          title="Import / Export"
          type="button"
        >
          <ArrowRightLeft size={15} />
          <span>Import / Export</span>
        </button>

        <button
          className="btn-compact w-full flex items-center gap-2"
          onClick={handleSystemPrint}
          title="Skriv ut"
          type="button"
        >
          <Printer size={15} />
          <span>Skriv ut</span>
        </button>

        <button
          className="btn-compact w-full flex items-center gap-2"
          onClick={() => setSettingsOpen(true)}
          title="Inställningar"
          type="button"
        >
          <SettingsIcon size={15} />
          <span>Inställningar</span>
        </button>
      </div>

      {/* ── Mobile FAB: New activity ──────────────────────────────────── */}
      <button
        className="lg:hidden fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full border-2 border-black bg-[#FFD93D] shadow-[4px_4px_0px_rgba(0,0,0,1)] flex items-center justify-center active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_rgba(0,0,0,1)] transition-all"
        onClick={() => { setEditingActivity(null); setModalOpen(true); }}
        aria-label="Ny aktivitet"
        type="button"
      >
        <Plus size={24} strokeWidth={3} />
      </button>

      {/* ── Modals ────────────────────────────────────────────────────── */}
      {showWeekPicker && (
        <WeekPicker
          selectedWeek={selectedWeek}
          selectedYear={selectedYear}
          onSelectWeek={setSelectedWeek}
          onChangeYear={setSelectedYear}
          onClose={() => setShowWeekPicker(false)}
        />
      )}

      <ActivityModal
        ref={modalRef}
        isOpen={modalOpen}
        isEditing={!!editingActivity}
        formData={formData}
        familyMembers={familyMembers}
        days={days}
        activity={editingActivity}
        onClose={() => setModalOpen(false)}
        onSave={(applyToSeries) => handleSaveActivity(formData, applyToSeries)}
        onDelete={(applyToSeries) => handleDeleteActivity(applyToSeries)}
        onFormChange={setFormData}
      />

      <SettingsModal
        ref={settingsModalRef}
        isOpen={settingsOpen}
        settings={settings}
        familyMembers={familyMembers}
        activities={activities}
        memberFormOpen={memberFormOpen}
        editingMember={editingMember}
        onClose={() => {
          setSettingsOpen(false);
          setMemberFormOpen(false);
          setEditingMember(null);
        }}
        onSettingsChange={handleSettingsChange}
        onEditMember={(member) => {
          setEditingMember(member);
          setMemberFormOpen(true);
        }}
        onSaveMember={handleSaveMember}
        onDeleteMember={handleDeleteMember}
        onCloseMemberForm={() => {
          setMemberFormOpen(false);
          setEditingMember(null);
        }}
      />

      <DataModal
        isOpen={dataModalOpen}
        onClose={handleCloseDataModal}
        onFileImport={handleFileImport}
        onTextImport={handleTextImport}
        onExportJSON={handleExportJSON}
        onExportICS={handleExportICS}
        selectedWeek={selectedWeek}
        selectedYear={selectedYear}
        onAIPreview={handleAIPreview}
        aiPreviewActivities={aiPreviewActivities}
        onAIImport={handleAIImport}
        aiImporting={aiImporting}
        aiImportError={aiImportError}
      />
    </div>
  );
}
