// src/components/Calendar/Calendar.tsx
'use client';

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayCard } from './DayCard';
import { Event } from './types';

export const Calendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [flippedDay, setFlippedDay] = useState<number | null>(null);
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
      days.push(<div key={`empty-${i}`} className="h-32" />);
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
            isFlipped={flippedDay === day}
            onFlip={() => setFlippedDay(day)}
            onClose={() => setFlippedDay(null)}
            onEventAdd={(event) => handleEventAdd(date, event)}
          />
        </div>
      );
    }

    return days;
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
    setFlippedDay(null);
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
    setFlippedDay(null);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setFlippedDay(null);
  };

  return (
    <div className="relative p-4">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          {currentDate.toLocaleString('default', { month: 'long' })} {currentDate.getFullYear()}
        </h2>
        <div className="flex gap-2">
          <Button onClick={goToToday} className="border-2 border-black">
            Today
          </Button>
          <Button onClick={prevMonth} className="border-2 border-black">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button onClick={nextMonth} className="border-2 border-black">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-4 mb-4">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center font-bold">
            {day}
          </div>
        ))}
      </div>
      
      <div className="grid grid-cols-7 gap-4">
        {renderCalendarDays()}
      </div>
    </div>
  );
};