// src/components/calendar/Calendar.tsx
'use client';

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayCard } from './DayCard';
import { DayModal } from './DayModal';
import { Event } from './types';

export const Calendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [events, setEvents] = useState<Record<string, Event[]>>({});

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const formatDateKey = (date: Date) => {
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  };

  const handleEventAdd = (date: Date, event: Omit<Event, 'id'>) => {
    const dateKey = formatDateKey(date);
    const newEvent = {
      ...event,
      id: Math.random().toString(36).substr(2, 9)
    };

    setEvents(prev => ({
      ...prev,
      [dateKey]: [...(prev[dateKey] || []), newEvent]
    }));
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

  return (
    <>
      <div className="relative p-4 bg-white rounded-xl border-2 border-black shadow-neo">
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
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
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
        />
      )}
    </>
  );
};