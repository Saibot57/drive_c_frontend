'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { AlertCircle } from 'lucide-react';
import { scheduleService } from '@/services/scheduleService';
import type {
  Activity,
  FamilyMember,
  FormData,
  Settings,
  CreateActivityPayload,
} from './types';
import type { ActivityImportItem } from '@/types/schedule';
import { WEEKDAYS_FULL, ALL_DAYS } from './constants';
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

  const [activities, setActivities] = useState<Activity[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [isReorderingMembers, setIsReorderingMembers] = useState(false);
  const [isSavingMemberOrder, setIsSavingMemberOrder] = useState(false);
  const [settings, setSettings] = useState<Settings>({ showWeekends: false, dayStart: 7, dayEnd: 18 });
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
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [aiPreviewActivities, setAiPreviewActivities] = useState<ActivityImportItem[]>([]);
  const [aiPreviewErrors, setAiPreviewErrors] = useState<{ index: number; message: string }[]>([]);
  const [aiParticipantWarnings, setAiParticipantWarnings] = useState<string[]>([]);
  const [aiImporting, setAiImporting] = useState(false);
  const [aiImportError, setAiImportError] = useState<string | null>(null);

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
      const mappedParticipants = (item.participants || []).map(participant => {
        const trimmed = participant.trim();
        if (!trimmed) return trimmed;
        if (participantIdSet.has(trimmed)) return trimmed;
        const lookupKey = trimmed.toLowerCase();
        return participantLookup[lookupKey] ?? trimmed;
      });

      return { ...item, participants: mappedParticipants };
    });

  const computeParticipantWarnings = (items: ActivityImportItem[]): string[] => {
    const unknown = new Set<string>();
    items.forEach(item => {
      (item.participants || []).forEach(participant => {
        const trimmed = participant.trim();
        if (!trimmed) return;
        if (participantIdSet.has(trimmed)) return;
        const lookupKey = trimmed.toLowerCase();
        if (!participantLookup[lookupKey]) {
          unknown.add(participant);
        }
      });
    });
    return Array.from(unknown);
  };

  const handleAIPreview = (
    ok: ActivityImportItem[],
    errors: { index: number; message: string }[],
  ) => {
    setAiPreviewActivities(ok);
    setAiPreviewErrors(errors);
    setAiImportError(null);
    setAiParticipantWarnings(computeParticipantWarnings(ok));
  };

  const handleCloseDataModal = () => {
    setDataModalOpen(false);
    setAiPreviewActivities([]);
    setAiPreviewErrors([]);
    setAiParticipantWarnings([]);
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
      if (settingsData) setSettings(settingsData);
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
        color: activityFromForm.color,
        week: selectedWeek,
        year: selectedYear,
      };

      if (activityFromForm.recurring && activityFromForm.recurringEndDate) {
        payload.recurringEndDate = activityFromForm.recurringEndDate;
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
      const updatedSettings = await scheduleService.updateSettings(newSettings);
      setSettings(updatedSettings);
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
        await fetchActivities(selectedYear, selectedWeek);
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
      await fetchActivities(selectedYear, selectedWeek);
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

  const handleSubmitMemberReorder = async () => {
    if (!isReorderingMembers) return;

    setIsSavingMemberOrder(true);
    const previousOrder = [...originalMemberOrderRef.current];

    try {
      const newOrderIds = familyMembers.map(member => member.id);
      const originalIds = previousOrder.map(member => member.id);
      const hasChanges =
        newOrderIds.length !== originalIds.length ||
        newOrderIds.some((id, index) => id !== originalIds[index]);

      if (!hasChanges) {
        setIsReorderingMembers(false);
        return;
      }

      const updatedMembers = await scheduleService.reorderFamilyMembers(newOrderIds);
      if (Array.isArray(updatedMembers) && updatedMembers.length > 0) {
        setFamilyMembers(updatedMembers);
      }

      setIsReorderingMembers(false);
    } catch (err) {
      console.error('Failed to reorder family members', err);
      setFamilyMembers(previousOrder);
      alert(err instanceof Error ? err.message : 'Kunde inte spara ordningen. Försök igen.');
      setIsReorderingMembers(false);
    } finally {
      originalMemberOrderRef.current = [];
      setIsSavingMemberOrder(false);
    }
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
      const prepared = mapParticipantsForImport(aiPreviewActivities);
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
  
  if (loading) return <div className="text-center p-10 font-monument">Laddar schema...</div>;
  if (error) return <div className="text-center p-10 font-monument text-red-600">Fel: {error}</div>;

  return (
    <div className="schedule-app-container">
      <Sidebar
        familyMembers={familyMembers}
        selectedWeek={selectedWeek}
        selectedYear={selectedYear}
        isCurrentWeek={isCurrentWeek}
        viewMode={viewMode}
        isReorderingMembers={isReorderingMembers}
        isSavingMemberOrder={isSavingMemberOrder}
        onNewActivity={() => { setEditingActivity(null); setModalOpen(true); }}
        onOpenSettings={() => setSettingsOpen(true)}
        onNavigateWeek={navigateWeek}
        onGoToCurrentWeek={goToCurrentWeek}
        onToggleWeekPicker={() => setShowWeekPicker(!showWeekPicker)}
        onOpenDataModal={() => setDataModalOpen(true)}
        onSetViewMode={setViewMode}
        onMemberClick={handleMemberClick}
        onStartReorder={handleStartMemberReorder}
        onSubmitReorder={handleSubmitMemberReorder}
        onReorderMembers={handleReorderMembers}
      />

      <div className="schedule-main-content">
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

        {/* Main Schedule View */}
        <div className="schedule-view-container">
          {viewMode === 'grid' ? (
            <ScheduleGrid
              days={days} weekDates={weekDates} timeSlots={timeSlots}
              activities={activities} familyMembers={familyMembers}
              settings={settings} selectedWeek={selectedWeek}
              selectedYear={selectedYear} onActivityClick={handleActivityClick}
            />
          ) : (
            <LayerView
              days={days} weekDates={weekDates} timeSlots={timeSlots}
              activities={activities} familyMembers={familyMembers}
              settings={settings} selectedWeek={selectedWeek}
              selectedYear={selectedYear} onActivityClick={handleActivityClick}
              highlightedMemberId={highlightedMemberId}
            />
          )}
        </div>
      </div>

      {/* Modals */}
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
        aiPreviewErrors={aiPreviewErrors}
        aiParticipantWarnings={aiParticipantWarnings}
        onAIImport={handleAIImport}
        aiImporting={aiImporting}
        aiImportError={aiImportError}
      />
    </div>
  );
}