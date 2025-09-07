'use client';

import { useState, useEffect, useRef } from 'react';
import { AlertCircle } from 'lucide-react';
import { scheduleService, createActivity } from '@/services/scheduleService';
import { getToken } from '@/services/authService';
import type { Activity, FamilyMember, FormData, Settings } from './types';
import { WEEKDAYS_FULL, WEEKEND_DAYS, ALL_DAYS } from './constants';
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

  const handleSaveActivity = async () => {
    if (!formData.name || formData.days.length === 0 || formData.participants.length === 0) {
      alert('Fyll i alla obligatoriska fält!');
      return;
    }
    try {
      if (editingActivity) {
        const updates: Partial<Activity> = { ...formData, day: formData.days[0] };
        await scheduleService.updateActivity(editingActivity.id, updates);
      } else {
        const token = getToken();
        if (!token) throw new Error('Authentication token is missing');
        await createActivity(formData as any, token);
      }
      await fetchData();
      setModalOpen(false);
      setEditingActivity(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte spara aktivitet.');
    }
  };

  const handleDeleteActivity = async () => {
    if (!editingActivity) return;
    try {
      if (editingActivity.seriesId && window.confirm("Ta bort hela serien?")) {
        await scheduleService.deleteActivitySeries(editingActivity.seriesId);
      } else {
        await scheduleService.deleteActivity(editingActivity.id);
      }
      await fetchData();
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
    try {
      const importedData = JSON.parse(jsonText);
      if (!Array.isArray(importedData)) throw new Error("JSON måste vara en array.");
      // ⬇️ ÄNDRA DENNA RAD
      await scheduleService.addActivitiesFromJson(importedData as any[]);
      // ⬆️ FRÅN: await scheduleService.addActivitiesFromJson({ activities: importedData });
      await fetchData();
      setDataModalOpen(false);
      alert(`${importedData.length} aktiviteter importerades!`);
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
        onClose={() => setModalOpen(false)}
        onSave={handleSaveActivity}
        onDelete={handleDeleteActivity}
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
