'use client';

import React, { useState, useEffect } from 'react';
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
    // Get day of week (0-6, where 0 is Sunday)
    let day = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    // Convert to Monday-first format (0-6, where 0 is Monday)
    return day === 0 ? 6 : day - 1;
  };

  const formatDateKey = (date: Date) => {
    // Ensure consistent zero-padding for month and day
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  // Function to get week number for a date
  const getWeekNumber = (date: Date) => {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    // Add 1 to index 0
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  };

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setIsLoading(true);
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);
        
        const backendEvents = await calendarService.getEvents(startOfMonth, endOfMonth);
        
        // Convert backend events to frontend format and organize by date
        const eventsByDate: Record<string, Event[]> = {};
        
        backendEvents.forEach(backendEvent => {
          // Create dates from millisecond timestamps
          const event: Event = {
            id: backendEvent.id,
            title: backendEvent.title,
            start: new Date(Number(backendEvent.start)), // Ensure timestamp is treated as number
            end: new Date(Number(backendEvent.end)),     // Ensure timestamp is treated as number
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

    // Optimistic: show immediately
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

      // Replace temp with real event
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
      // Rollback
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

    // Optimistic: update immediately
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
      // Rollback
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

    // Optimistic: remove immediately
    setEvents(prev => ({
      ...prev,
      [dateKey]: prev[dateKey]?.filter(event => event.id !== eventId) || []
    }));

    try {
      await calendarService.deleteEvent(eventId);
    } catch (error) {
      // Rollback
      setEvents(prev => ({
        ...prev,
        [dateKey]: previousEvents
      }));
      console.error("Failed to delete event:", error);
      setError("Kunde inte ta bort händelse. Försök igen.");
    }
  };

  const renderCalendarDays = () => {
    const days = [];
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    
    // Track which dates belong to which week
    const weekMap: Record<number, number> = {};
    let currentWeekNumber = 0;
    let currentWeek = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(
        <div key={`empty-${i}`} className="h-28 rounded-lg border-2 border-black/10 bg-gray-50" />
      );
      currentWeek.push(null);
    }

    // Add cells for each day of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const dateKey = formatDateKey(date);
      const dayEvents = events[dateKey] || [];
      
      days.push(
        <div key={day} className="relative h-28">
          <DayCard
            date={date}
            events={dayEvents}
            onClick={() => setSelectedDate(date)}
          />
        </div>
      );
      
      currentWeek.push(date);
      
      // If we have 7 days or it's the last day of the month, start a new week
      if (currentWeek.length === 7 || day === daysInMonth) {
        // Find the first non-null date in the week to get the week number
        const firstDateInWeek = currentWeek.find(d => d !== null);
        if (firstDateInWeek) {
          currentWeekNumber = getWeekNumber(firstDateInWeek);
          // Store the week number for each position
          weekMap[days.length - currentWeek.length] = currentWeekNumber;
        }
        currentWeek = [];
      }
    }

    // Create week labels and calendar grid
    const weekLabels = Object.entries(weekMap).map(([startIndex, weekNum]) => (
      <div 
        key={`week-${weekNum}`} 
        className="absolute left-[-55px] flex items-center justify-center font-monument text-xs"
        style={{ 
          top: `${Math.floor(parseInt(startIndex) / 7) * 31 * 4}px`, // Position vertically
          height: '31px',
          width: '40px'
        }}
      >
        v. {weekNum}
      </div>
    ));

    return { days, weekLabels };
  };

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
        console.log('Saving notes for date:', selectedDate, notes);
        await calendarService.saveDayNote(selectedDate, notes);
        console.log('Notes saved successfully');
      }
    } catch (error) {
      console.error("Failed to save notes:", error);
      setError("Kunde inte spara anteckningar");
    }
  };

  const { days, weekLabels } = renderCalendarDays();

  return (
    <>
      <div className="relative p-2 bg-white rounded-xl border-2 border-black shadow-neo">
        {isLoading && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
            <p>Laddar händelser…</p>
          </div>
        )}
        
        {error && (
          <div className="mb-3 p-2 bg-red-100 border border-red-300 text-red-700 rounded">
            {error}
            <Button 
              onClick={() => setError(null)}
              className="ml-2 h-6 w-6 p-0 text-red-700 bg-transparent hover:bg-red-200"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        
        <div className="mb-4 flex items-center justify-between border-b-2 border-black pb-2">
          <h2 className="text-3xl font-monument uppercase">
            {currentDate.toLocaleString('sv-SE', { month: 'long' })} {currentDate.getFullYear()}
          </h2>
          <div className="flex gap-2">
            <Button 
              onClick={goToToday} 
              className={`border-2 border-black transition-colors h-8 text-sm ${
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
              className="border-2 border-black bg-white hover:bg-gray-50 h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button 
              onClick={nextMonth}
              variant="neutral" 
              className="border-2 border-black bg-white hover:bg-gray-50 h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-3 mb-3 ml-10">
          {['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'].map(day => (
            <div key={day} className="text-center font-monument text-base">
              {day}
            </div>
          ))}
        </div>

        <div className="relative">
          {/* Week number labels */}
          <div className="absolute left-0 top-0 bottom-0 w-10">
            {weekLabels}
          </div>
          
          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-3 ml-10">
            {days}
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