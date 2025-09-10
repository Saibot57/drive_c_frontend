'use client';

import { useState, useEffect, useRef } from 'react';
import { AlertCircle } from 'lucide-react';
import { scheduleService } from '@/services/scheduleService';
import type {
  Activity,
  FamilyMember,
  FormData,
  Settings,
  CreateActivityPayload,
} from './types';
import { WEEKDAYS_FULL, ALL_DAYS } from './constants';
import { getWeekNumber, getWeekDateRange, isWeekInPast, isWeekInFuture } from './utils/dateUtils';
import { generateTimeSlots } from './utils/scheduleUtils';
import { downloadAllICS } from './utils/exportUtils';
import { useFocusTrap } from './hooks/useFocusTrap';

import { Header } from './components/Header';
import { FamilyBar } from './components/FamilyBar';
import { WeekNavigation } from './components/WeekNavigation';
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

  const [activities, setActivities] = useState<Activity[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
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

      // --- Tillfällig debug för ikonproblem ---
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.log('Family members:', membersData);
        membersData.forEach(m => {
          // eslint-disable-next-line no-console
          console.log(`${m.name}: icon="${m.icon}" (char codes: ${Array.from(m.icon || '').map((c: string) => c.charCodeAt(0)).join(', ')})`);
        });
      }
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

      if (activityFromForm.recurring) {
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

  const handleTextImport = async (jsonText: string) => {
    console.log("=== IMPORT STARTED ==="); // <-- Lägg till denna rad
    try {
      const importedData = JSON.parse(jsonText);
      if (!Array.isArray(importedData)) throw new Error("JSON måste vara en array.");
      
      // Debug: Check if family members are loaded
      console.log("Family members loaded:", familyMembers);
      
      // If familyMembers is empty, fetch them first
      if (!familyMembers || familyMembers.length === 0) {
        alert("Familjemedlemmar har inte laddats än. Vänta en sekund och försök igen.");
        await fetchData();
        return;
      }
      
      // Create a mapping of participant names to IDs (case-insensitive)
      const participantNameToId: Record<string, string> = {};
      familyMembers.forEach(member => {
        participantNameToId[member.name.toLowerCase()] = member.id;
        console.log(`Mapped: "${member.name}" (${member.name.toLowerCase()}) -> ${member.id}`);
      });
      
      // Transform activities with date field to week/year/day format
      // and map participant names to IDs
      const transformedData = importedData.map((activity: any) => {
        let transformedActivity: any = { ...activity };
        
        // If activity has a date field, convert it
        if (activity.date) {
          const date = new Date(activity.date);
          const week = getWeekNumber(date);
          const year = date.getFullYear();
          
          // Get Swedish day name
          const dayNames = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];
          const day = dayNames[date.getDay()];
          
          // Remove date field and add week/year/day
          const { date: _, ...activityWithoutDate } = transformedActivity;
          transformedActivity = {
            ...activityWithoutDate,
            week,
            year,
            day
          };
        }
        
        // Map participant names to IDs
        if (transformedActivity.participants && Array.isArray(transformedActivity.participants)) {
          console.log(`Activity "${transformedActivity.name}" has participants:`, transformedActivity.participants);
          
          transformedActivity.participants = transformedActivity.participants.map((participant: any) => {
            // If it's already an ID (looks like a UUID), keep it
            if (typeof participant === 'string' && participant.includes('-')) {
              console.log(`  - "${participant}" looks like UUID, keeping as-is`);
              return participant;
            }
            
            // Otherwise, try to map the name to an ID
            const participantLower = String(participant).toLowerCase();
            const id = participantNameToId[participantLower];
            
            if (!id) {
              console.warn(`  - Kunde inte hitta familjemedlem: "${participant}" (sökte efter "${participantLower}")`);
              console.log(`  - Tillgängliga namn:`, Object.keys(participantNameToId));
            } else {
              console.log(`  - Mapped "${participant}" -> ${id}`);
            }
            
            return id || participant;
          }).filter(Boolean); // Remove any undefined values
          
          console.log(`  Final participants for activity:`, transformedActivity.participants);
        }
        
        return transformedActivity;
      });
      
      await scheduleService.addActivitiesFromJson(transformedData);
      await fetchData();
      setDataModalOpen(false);
      alert(`${transformedData.length} aktiviteter importerades!`);
    } catch (err: any) {
      const errorMessage = err?.details
        ? `${err.message}\n\nKonflikter:\n${JSON.stringify(err.details, null, 2)}`
        : err?.message || 'Okänt fel';
      alert(`Import misslyckades: ${errorMessage}`);
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
    setDataModalOpen(false);
  };
  
  const handleExportICS = () => {
    downloadAllICS(activities);
    setDataModalOpen(false);
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
  
  if (loading) return <div className="text-center p-10 font-monument">Laddar schema...</div>;
  if (error) return <div className="text-center p-10 font-monument text-red-600">Fel: {error}</div>;

  return (
    <div className="content-wrapper">
      <Header
        selectedWeek={selectedWeek}
        selectedYear={selectedYear}
        weekDates={weekDates}
        onNewActivity={() => { setEditingActivity(null); setModalOpen(true); }}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <FamilyBar
        members={familyMembers}
        viewMode={viewMode}
        onSetViewMode={setViewMode}
        onMemberClick={(id) => { setViewMode('layer'); setHighlightedMemberId(id); }}
      />
      <WeekNavigation
        isCurrentWeek={isCurrentWeek}
        onNavigateWeek={navigateWeek}
        onGoToCurrentWeek={goToCurrentWeek}
        onToggleWeekPicker={() => setShowWeekPicker(!showWeekPicker)}
        onOpenDataModal={() => setDataModalOpen(true)}
      />
      {showWeekPicker && (
        <WeekPicker
          selectedWeek={selectedWeek}
          selectedYear={selectedYear}
          onSelectWeek={setSelectedWeek}
          onChangeYear={setSelectedYear}
          onClose={() => setShowWeekPicker(false)}
        />
      )}
      {!isCurrentWeek && (
        <div className="notice-banner" role="alert">
          <AlertCircle size={24}/>
          Du tittar på {isWeekInPast(weekDates) ? 'en tidigare' : isWeekInFuture(weekDates) ? 'en kommande' : 'en annan'} vecka
        </div>
      )}
      {showConflict && (
        <div className="notice-banner conflict-banner" role="alert">
          <AlertCircle size={24}/> Tidskonflikt! En deltagare är redan upptagen.
        </div>
      )}
      
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
        onClose={() => setSettingsOpen(false)}
        onSettingsChange={handleSettingsChange}
      />
      <DataModal
        isOpen={dataModalOpen}
        onClose={() => setDataModalOpen(false)}
        onFileImport={handleFileImport}
        onTextImport={handleTextImport}
        onExportJSON={handleExportJSON}
        onExportICS={handleExportICS}
      />
    </div>
  );
}