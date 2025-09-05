import { useState, useEffect, useCallback } from 'react';
import { activityService, settingsService } from '../lib/firebase';
import type { Activity, Settings } from '../types';

export function useFirebaseActivities(fallbackToLocal: boolean = true) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    loadActivities();
  }, []);

  const loadActivities = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await activityService.getAll();
      setActivities(data);
      
      // Synka med localStorage som backup
      if (fallbackToLocal) {
        localStorage.setItem('familjens-schema-activities', JSON.stringify(data));
      }
    } catch (err) {
      setError(err as Error);
      
      // Fallback till localStorage om Firebase inte fungerar
      if (fallbackToLocal) {
        const stored = localStorage.getItem('familjens-schema-activities');
        if (stored) {
          setActivities(JSON.parse(stored));
          console.log('Loaded from localStorage as fallback');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const saveActivities = useCallback(async (newActivities: Activity[]) => {
    try {
      setError(null);
      await activityService.create(newActivities);
      
      // Uppdatera lokalt state
      setActivities(prev => [...prev, ...newActivities]);
      
      // Backup till localStorage
      if (fallbackToLocal) {
        const allActivities = [...activities, ...newActivities];
        localStorage.setItem('familjens-schema-activities', JSON.stringify(allActivities));
      }
      
      return newActivities;
    } catch (err) {
      setError(err as Error);
      
      // Om Firebase misslyckas, spara ändå lokalt
      if (fallbackToLocal) {
        setActivities(prev => [...prev, ...newActivities]);
        const allActivities = [...activities, ...newActivities];
        localStorage.setItem('familjens-schema-activities', JSON.stringify(allActivities));
        console.log('Saved to localStorage as fallback');
      }
      
      throw err;
    }
  }, [activities, fallbackToLocal]);

  const updateActivity = useCallback(async (activity: Activity) => {
    try {
      setError(null);
      await activityService.update(activity);
      
      setActivities(prev => prev.map(a => 
        a.id === activity.id ? activity : a
      ));
      
      if (fallbackToLocal) {
        const newActivities = activities.map(a => 
          a.id === activity.id ? activity : a
        );
        localStorage.setItem('familjens-schema-activities', JSON.stringify(newActivities));
      }
      
      return activity;
    } catch (err) {
      setError(err as Error);
      
      // Uppdatera lokalt även om Firebase misslyckas
      if (fallbackToLocal) {
        setActivities(prev => prev.map(a => 
          a.id === activity.id ? activity : a
        ));
        const newActivities = activities.map(a => 
          a.id === activity.id ? activity : a
        );
        localStorage.setItem('familjens-schema-activities', JSON.stringify(newActivities));
      }
      
      throw err;
    }
  }, [activities, fallbackToLocal]);

  const deleteActivity = useCallback(async (id: string) => {
    try {
      setError(null);
      await activityService.delete(id);
      
      setActivities(prev => prev.filter(a => a.id !== id));
      
      if (fallbackToLocal) {
        const newActivities = activities.filter(a => a.id !== id);
        localStorage.setItem('familjens-schema-activities', JSON.stringify(newActivities));
      }
    } catch (err) {
      setError(err as Error);
      
      // Ta bort lokalt även om Firebase misslyckas
      if (fallbackToLocal) {
        setActivities(prev => prev.filter(a => a.id !== id));
        const newActivities = activities.filter(a => a.id !== id);
        localStorage.setItem('familjens-schema-activities', JSON.stringify(newActivities));
      }
      
      throw err;
    }
  }, [activities, fallbackToLocal]);

  const deleteActivitySeries = useCallback(async (seriesId: string) => {
    try {
      setError(null);
      await activityService.deleteSeries(seriesId);
      
      setActivities(prev => prev.filter(a => a.seriesId !== seriesId));
      
      if (fallbackToLocal) {
        const newActivities = activities.filter(a => a.seriesId !== seriesId);
        localStorage.setItem('familjens-schema-activities', JSON.stringify(newActivities));
      }
    } catch (err) {
      setError(err as Error);
      
      // Ta bort lokalt även om Firebase misslyckas
      if (fallbackToLocal) {
        setActivities(prev => prev.filter(a => a.seriesId !== seriesId));
        const newActivities = activities.filter(a => a.seriesId !== seriesId);
        localStorage.setItem('familjens-schema-activities', JSON.stringify(newActivities));
      }
      
      throw err;
    }
  }, [activities, fallbackToLocal]);

  return {
    activities,
    loading,
    error,
    setActivities, // Exponera setActivities för direkt uppdatering från App.tsx
    saveActivities,
    updateActivity,
    deleteActivity,
    deleteActivitySeries,
    reload: loadActivities
  };
}

export function useFirebaseSettings() {
  const [settings, setSettings] = useState<Settings>({
    showWeekends: false,
    dayStart: 7,
    dayEnd: 18
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await settingsService.get();
      setSettings(data);
      
      // Synka med localStorage
      localStorage.setItem('familjens-schema-settings', JSON.stringify(data));
    } catch (err) {
      setError(err as Error);
      
      // Fallback till localStorage
      const stored = localStorage.getItem('familjens-schema-settings');
      if (stored) {
        setSettings(JSON.parse(stored));
      }
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = useCallback(async (newSettings: Settings) => {
    try {
      setError(null);
      const updated = await settingsService.update(newSettings);
      setSettings(updated);
      
      // Backup till localStorage
      localStorage.setItem('familjens-schema-settings', JSON.stringify(updated));
      
      return updated;
    } catch (err) {
      setError(err as Error);
      
      // Spara lokalt även om Firebase misslyckas
      setSettings(newSettings);
      localStorage.setItem('familjens-schema-settings', JSON.stringify(newSettings));
      
      console.log('Saved settings to localStorage as fallback');
    }
  }, []);

  return {
    settings,
    setSettings, // Exponera setSettings för direkt uppdatering
    loading,
    error,
    saveSettings,
    reload: loadSettings
  };
}