'use client';

import { useCallback, useEffect, useState } from 'react';
import { ROOMS_KEY, TEACHERS_KEY } from '@/components/schedule/constants';

export const useHiddenSettings = () => {
  const [teachers, setTeachers] = useState<string[]>([]);
  const [rooms, setRooms] = useState<string[]>([]);
  const [isHiddenSettingsOpen, setIsHiddenSettingsOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const storedTeachers = window.localStorage.getItem(TEACHERS_KEY);
      const storedRooms = window.localStorage.getItem(ROOMS_KEY);
      const parsedTeachers = storedTeachers ? JSON.parse(storedTeachers) : [];
      const parsedRooms = storedRooms ? JSON.parse(storedRooms) : [];
      setTeachers(Array.isArray(parsedTeachers) ? parsedTeachers.filter(item => typeof item === 'string') : []);
      setRooms(Array.isArray(parsedRooms) ? parsedRooms.filter(item => typeof item === 'string') : []);
    } catch (error) {
      console.warn('Kunde inte läsa lärare/salar.', error);
    }
  }, []);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'k') return;
      if (!event.ctrlKey || !event.shiftKey) return;
      event.preventDefault();
      setIsHiddenSettingsOpen(true);
    };
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, []);

  const handleHiddenSettingsSave = useCallback((nextTeachers: string[], nextRooms: string[]) => {
    setTeachers(nextTeachers);
    setRooms(nextRooms);
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(TEACHERS_KEY, JSON.stringify(nextTeachers));
      window.localStorage.setItem(ROOMS_KEY, JSON.stringify(nextRooms));
    } catch (error) {
      console.warn('Kunde inte spara lärare/salar.', error);
    }
  }, []);

  return {
    teachers,
    rooms,
    isHiddenSettingsOpen,
    setIsHiddenSettingsOpen,
    handleHiddenSettingsSave
  };
};
