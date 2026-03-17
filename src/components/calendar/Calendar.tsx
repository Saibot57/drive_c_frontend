'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { DayCard } from './DayCard';
import { DayModal } from './DayModal';
import { Event } from './types';
import { calendarService } from '@/services/calendarService';

export const Calendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [events, setEvents] = useState<Record<string, Event[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    let day = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    return day === 0 ? 6 : day - 1; // Monday-first
  };

  const formatDateKey = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const getWeekNumber = (date: Date) => {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  };

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setIsLoading(true);
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);

        const backendEvents = await calendarService.getEvents(startOfMonth, endOfMonth);

        const eventsByDate: Record<string, Event[]> = {};

        backendEvents.forEach(backendEvent => {
          const event: Event = {
            id: backendEvent.id,
            title: backendEvent.title,
            start: new Date(Number(backendEvent.start)),
            end: new Date(Number(backendEvent.end)),
            notes: backendEvent.notes,
            color: backendEvent.color
          };

          const dateKey = formatDateKey(event.start);
          if (!eventsByDate[dateKey]) {
            eventsByDate[dateKey] = [];
          }

          eventsByDate[dateKey].push(event);
        });

        setEvents(eventsByDate);
      } catch (error) {
        console.error("Failed to fetch events:", error);
        setError("Kunde inte ladda händelser");
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvents();
  }, [currentDate]);

  const handleEventAdd = async (date: Date, event: Omit<Event, 'id'>) => {
    const tempId = `temp-${Date.now()}`;
    const dateKey = formatDateKey(date);
    const optimisticEvent: Event = { ...event, id: tempId };

    setEvents(prev => ({
      ...prev,
      [dateKey]: [...(prev[dateKey] || []), optimisticEvent]
    }));

    try {
      const backendEvent = {
        title: event.title,
        start: event.start.getTime(),
        end: event.end.getTime(),
        notes: event.notes,
        color: event.color
      };

      const savedEvent = await calendarService.createEvent(backendEvent);

      const realEvent: Event = {
        id: savedEvent.id,
        title: savedEvent.title,
        start: new Date(Number(savedEvent.start)),
        end: new Date(Number(savedEvent.end)),
        notes: savedEvent.notes,
        color: savedEvent.color
      };

      setEvents(prev => ({
        ...prev,
        [dateKey]: prev[dateKey]?.map(e => e.id === tempId ? realEvent : e) || [realEvent]
      }));
    } catch (error) {
      setEvents(prev => ({
        ...prev,
        [dateKey]: prev[dateKey]?.filter(e => e.id !== tempId) || []
      }));
      console.error("Failed to save event:", error);
      setError("Kunde inte spara händelse. Försök igen.");
    }
  };

  const handleEventUpdate = async (date: Date, eventId: string, updates: Partial<Event>) => {
    const dateKey = formatDateKey(date);
    const existingEvent = events[dateKey]?.find(e => e.id === eventId);

    if (!existingEvent) {
      console.error(`Event with ID ${eventId} not found for date ${dateKey}`);
      return;
    }

    setEvents(prev => ({
      ...prev,
      [dateKey]: prev[dateKey]?.map(event =>
        event.id === eventId ? { ...event, ...updates } : event
      ) || []
    }));

    try {
      const backendUpdates: any = { ...updates };
      if (updates.start) backendUpdates.start = updates.start.getTime();
      if (updates.end) backendUpdates.end = updates.end.getTime();

      await calendarService.updateEvent(eventId, backendUpdates);
    } catch (error) {
      setEvents(prev => ({
        ...prev,
        [dateKey]: prev[dateKey]?.map(event =>
          event.id === eventId ? existingEvent : event
        ) || []
      }));
      console.error("Failed to update event:", error);
      setError("Kunde inte uppdatera händelse. Försök igen.");
    }
  };

  const handleEventDelete = async (date: Date, eventId: string) => {
    const dateKey = formatDateKey(date);
    const previousEvents = events[dateKey] || [];

    setEvents(prev => ({
      ...prev,
      [dateKey]: prev[dateKey]?.filter(event => event.id !== eventId) || []
    }));

    try {
      await calendarService.deleteEvent(eventId);
    } catch (error) {
      setEvents(prev => ({
        ...prev,
        [dateKey]: previousEvents
      }));
      console.error("Failed to delete event:", error);
      setError("Kunde inte ta bort händelse. Försök igen.");
    }
  };

  // ── Build the calendar grid ──────────────────────────────────────────────

  const calendarGrid = useMemo(() => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const totalCells = firstDay + daysInMonth;
    const numRows = Math.ceil(totalCells / 7);

    const cells: React.ReactNode[] = [];
    const weekNumbers: number[] = [];

    for (let row = 0; row < numRows; row++) {
      // Find a representative day in this row to get the week number
      const firstDayInRow = row * 7 - firstDay + 1;
      const representativeDay = Math.max(1, Math.min(firstDayInRow, daysInMonth));
      const repDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), representativeDay);
      weekNumbers.push(getWeekNumber(repDate));

      // 7 day cells for this row
      for (let col = 0; col < 7; col++) {
        const cellIndex = row * 7 + col;
        const dayNum = cellIndex - firstDay + 1;

        if (dayNum < 1 || dayNum > daysInMonth) {
          cells.push(
            <div key={`empty-${cellIndex}`} className="rounded-lg border-2 border-black/10 bg-gray-50 min-h-0" />
          );
        } else {
          const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), dayNum);
          const dateKey = formatDateKey(date);
          const dayEvents = events[dateKey] || [];
          cells.push(
            <div key={dayNum} className="relative min-h-0">
              <DayCard
                date={date}
                events={dayEvents}
                onClick={() => setSelectedDate(date)}
              />
            </div>
          );
        }
      }
    }

    return { cells, weekNumbers, numRows };
  }, [currentDate, events]);

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const isCurrentMonth = (date: Date) => {
    const today = new Date();
    return date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  const handleSaveNotes = async (notes: string) => {
    try {
      if (selectedDate) {
        await calendarService.saveDayNote(selectedDate, notes);
      }
    } catch (error) {
      console.error("Failed to save notes:", error);
      setError("Kunde inte spara anteckningar");
    }
  };

  const { cells, weekNumbers, numRows } = calendarGrid;

  return (
    <>
      <div className="relative h-full flex flex-col p-2 bg-white rounded-xl border-2 border-black shadow-neo">
        {isLoading && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
            <p>Laddar händelser...</p>
          </div>
        )}

        {error && (
          <div className="mb-2 p-2 bg-red-100 border border-red-300 text-red-700 rounded shrink-0">
            {error}
            <Button
              onClick={() => setError(null)}
              className="ml-2 h-6 w-6 p-0 text-red-700 bg-transparent hover:bg-red-200"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Header */}
        <div className="mb-2 flex items-center justify-between border-b-2 border-black pb-2 shrink-0">
          <h2 className="text-xl font-monument uppercase">
            {currentDate.toLocaleString('sv-SE', { month: 'long' })} {currentDate.getFullYear()}
          </h2>
          <div className="flex gap-1">
            <Button
              onClick={goToToday}
              className={`border-2 border-black transition-colors h-7 text-xs ${
                isCurrentMonth(currentDate)
                  ? 'bg-white text-black hover:bg-[#ff6b6b]/90'
                  : 'bg-white hover:bg-gray-50'
              }`}
              variant="default"
            >
              Idag
            </Button>
            <Button
              onClick={prevMonth}
              variant="neutral"
              className="border-2 border-black bg-white hover:bg-gray-50 h-7 w-7 p-0"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              onClick={nextMonth}
              variant="neutral"
              className="border-2 border-black bg-white hover:bg-gray-50 h-7 w-7 p-0"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Day names row */}
        <div
          className="grid gap-1 mb-1 shrink-0"
          style={{ gridTemplateColumns: '2rem repeat(7, 1fr)' }}
        >
          <div /> {/* Week number column spacer */}
          {['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'].map(day => (
            <div key={day} className="text-center font-monument text-xs">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid — fills remaining space */}
        <div className="flex flex-1 min-h-0 gap-1">
          {/* Week numbers column */}
          <div
            className="grid gap-1 w-8 shrink-0"
            style={{ gridTemplateRows: `repeat(${numRows}, minmax(0, 1fr))` }}
          >
            {weekNumbers.map((wn, i) => (
              <div key={i} className="flex items-center justify-center font-monument text-2xs text-gray-500">
                v.{wn}
              </div>
            ))}
          </div>

          {/* Day cells grid */}
          <div
            className="grid flex-1 gap-1 min-h-0"
            style={{
              gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
              gridTemplateRows: `repeat(${numRows}, minmax(0, 1fr))`,
            }}
          >
            {cells}
          </div>
        </div>
      </div>

      {selectedDate && (
        <DayModal
          date={selectedDate}
          events={events[formatDateKey(selectedDate)] || []}
          isOpen={!!selectedDate}
          onClose={() => setSelectedDate(null)}
          onEventAdd={(event) => handleEventAdd(selectedDate, event)}
          onEventUpdate={(id, updates) => handleEventUpdate(selectedDate, id, updates)}
          onEventDelete={(id) => handleEventDelete(selectedDate, id)}
          onSaveNotes={(notes) => handleSaveNotes(notes)}
        />
      )}
    </>
  );
};
