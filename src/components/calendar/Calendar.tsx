// src/components/calendar/Calendar.tsx
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
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  };

  // Fetch events from the backend when the month changes
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
          const event: Event = {
            id: backendEvent.id,
            title: backendEvent.title,
            start: new Date(backendEvent.start),
            end: new Date(backendEvent.end),
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
        setError("Failed to load events");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchEvents();
  }, [currentDate]);

  // Updated to save to backend
  const handleEventAdd = async (date: Date, event: Omit<Event, 'id'>) => {
    try {
      // Make a copy of the event to remove any UI-specific fields
      const eventToSave = { ...event };
      delete eventToSave.isEditing;
      
      // Prepare event for backend
      const backendEvent = {
        title: eventToSave.title,
        start: eventToSave.start.toISOString(),
        end: eventToSave.end.toISOString(),
        notes: eventToSave.notes,
        color: eventToSave.color
      };
      
      // Save to backend
      const savedEvent = await calendarService.createEvent(backendEvent);
      
      // Update local state with the returned event (including the ID)
      const newEvent: Event = {
        id: savedEvent.id,
        title: savedEvent.title,
        start: new Date(savedEvent.start),
        end: new Date(savedEvent.end),
        notes: savedEvent.notes,
        color: savedEvent.color,
        isEditing: event.isEditing // Preserve the editing state if it was set
      };
      
      const dateKey = formatDateKey(date);
      setEvents(prev => ({
        ...prev,
        [dateKey]: [...(prev[dateKey] || []), newEvent]
      }));
    } catch (error) {
      console.error("Failed to save event:", error);
      setError("Failed to save event");
    }
  };

  // Updated to save to backend
  const handleEventUpdate = async (date: Date, eventId: string, updates: Partial<Event>) => {
    try {
      // Get the existing event to merge with updates
      const dateKey = formatDateKey(date);
      const existingEvent = events[dateKey]?.find(e => e.id === eventId);
      
      if (!existingEvent) {
        console.error(`Event with ID ${eventId} not found for date ${dateKey}`);
        return;
      }
      
      // Make a copy of the updates to remove any UI-specific fields before sending to backend
      const updatesToSave = { ...updates };
      delete updatesToSave.isEditing;
      
      // Only send to backend if we have fields to update
      if (Object.keys(updatesToSave).length > 0) {
        // Prepare updates for backend
        const backendUpdates: any = { ...updatesToSave };
        
        // Convert Date objects to ISO strings
        if (updatesToSave.start) backendUpdates.start = updatesToSave.start.toISOString();
        if (updatesToSave.end) backendUpdates.end = updatesToSave.end.toISOString();
        
        // Update on backend
        await calendarService.updateEvent(eventId, backendUpdates);
      }
      
      // Update local state (including UI-specific fields)
      setEvents(prev => ({
        ...prev,
        [dateKey]: prev[dateKey]?.map(event => 
          event.id === eventId ? { ...event, ...updates } : event
        ) || []
      }));
    } catch (error) {
      console.error("Failed to update event:", error);
      setError("Failed to update event");
    }
  };

  // Updated to delete from backend
  const handleEventDelete = async (date: Date, eventId: string) => {
    try {
      // Delete from backend
      await calendarService.deleteEvent(eventId);
      
      // Update local state
      const dateKey = formatDateKey(date);
      setEvents(prev => ({
        ...prev,
        [dateKey]: prev[dateKey]?.filter(event => event.id !== eventId) || []
      }));
    } catch (error) {
      console.error("Failed to delete event:", error);
      setError("Failed to delete event");
    }
  };

  const renderCalendarDays = () => {
    const days = [];
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(
        <div key={`empty-${i}`} className="h-32 rounded-lg border-2 border-black/10 bg-gray-50" />
      );
    }

    // Add cells for each day of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const dateKey = formatDateKey(date);
      const dayEvents = events[dateKey] || [];

      days.push(
        <div key={day} className="relative h-32">
          <DayCard
            date={date}
            events={dayEvents}
            onClick={() => setSelectedDate(date)}
          />
        </div>
      );
    }

    return days;
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
        await calendarService.saveDayNote(selectedDate, notes);
      }
    } catch (error) {
      console.error("Failed to save notes:", error);
      setError("Failed to save notes");
    }
  };

  return (
    <>
      <div className="relative p-4 bg-white rounded-xl border-2 border-black shadow-neo">
        {isLoading && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
            <p>Loading events...</p>
          </div>
        )}
        
        {error && (
          <div className="mb-4 p-2 bg-red-100 border border-red-300 text-red-700 rounded">
            {error}
            <Button 
              onClick={() => setError(null)}
              className="ml-2 h-6 w-6 p-0 text-red-700 bg-transparent hover:bg-red-200"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        
        <div className="mb-6 flex items-center justify-between border-b-2 border-black pb-4">
          <h2 className="text-4xl font-monument uppercase">
            {currentDate.toLocaleString('default', { month: 'long' })} {currentDate.getFullYear()}
          </h2>
          <div className="flex gap-2">
            <Button 
              onClick={goToToday} 
              className={`border-2 border-black transition-colors ${
                isCurrentMonth(currentDate) 
                  ? 'bg-[#ff6b6b] text-white hover:bg-[#ff6b6b]/90'
                  : 'bg-white hover:bg-gray-50'
              }`}
              variant="default"
            >
              Today
            </Button>
            <Button 
              onClick={prevMonth} 
              variant="neutral"
              className="border-2 border-black bg-white hover:bg-gray-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button 
              onClick={nextMonth}
              variant="neutral" 
              className="border-2 border-black bg-white hover:bg-gray-50"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-4 mb-4">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
            <div key={day} className="text-center font-monument text-lg">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-4">
          {renderCalendarDays()}
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