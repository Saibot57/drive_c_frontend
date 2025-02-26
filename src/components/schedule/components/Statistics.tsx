'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent
} from '@/components/ui/card';
import type { Box, Schedule, Restriction } from '../types';

interface StatisticsProps {
  boxes: Box[];
  schedule: Schedule;
  scheduleRef: React.RefObject<HTMLDivElement>;
  setBoxes: React.Dispatch<React.SetStateAction<Box[]>>;
  setSchedule: React.Dispatch<React.SetStateAction<Schedule>>;
  setRestrictions: React.Dispatch<React.SetStateAction<Restriction[]>>;
}

export function Statistics({ schedule, boxes }: StatisticsProps) {
  const [classesExpanded, setClassesExpanded] = useState(true);
  const [teachersExpanded, setTeachersExpanded] = useState(true);

  const formatTimeSlots = (slots: Array<{ day: string; time: string }>) => {
    const dayOrder = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag'];
    const sortedSlots = [...slots].sort((a, b) => {
      const dayDiff = dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
      if (dayDiff !== 0) return dayDiff;
      return a.time.localeCompare(b.time);
    });

    return sortedSlots.reduce((acc, { day, time }) => {
      if (!acc[day]) acc[day] = [];
      acc[day].push(time);
      return acc;
    }, {} as Record<string, string[]>);
  };

  const getClassStatistics = () => {
    const stats = Object.entries(schedule).reduce((acc, [slot, boxId]) => {
      const box = boxes.find(b => b.id === boxId);
      if (box) {
        const [day, time] = slot.split('-');
        if (!acc[box.className]) {
          acc[box.className] = [];
        }
        acc[box.className].push({ day, time });
      }
      return acc;
    }, {} as Record<string, Array<{ day: string; time: string }>>);

    return Object.entries(stats).map(([className, slots]) => ({
      className,
      slots: formatTimeSlots(slots),
      count: slots.length
    }));
  };

  const formatSlotList = (slots: Record<string, string[]>) => {
    return Object.entries(slots)
      .map(([day, times]) => `${day}: ${times.sort().join(', ')}`)
      .join('\n');
  };

  const getTeacherStatistics = () => {
    const stats = Object.entries(schedule).reduce((acc, [slot, boxId]) => {
      const box = boxes.find(b => b.id === boxId);
      if (box) {
        const [day, time] = slot.split('-');
        if (!acc[box.teacher]) {
          acc[box.teacher] = {};
        }
        if (!acc[box.teacher][box.className]) {
          acc[box.teacher][box.className] = [];
        }
        acc[box.teacher][box.className].push({ day, time });
      }
      return acc;
    }, {} as Record<string, Record<string, Array<{ day: string; time: string }>>>);

    return Object.entries(stats).map(([teacher, classes]) => ({
      teacher,
      classes: Object.entries(classes).map(([className, slots]) => ({
        className,
        slots: formatTimeSlots(slots)
      })),
      totalCount: Object.values(classes).reduce((sum, slots) => sum + slots.length, 0)
    }));
  };

  const formatTeacherSlots = (classes: Array<{ className: string; slots: Record<string, string[]> }>) => {
    return classes
      .map(({ className, slots }) => 
        `${className}:\n${formatSlotList(slots)}`
      )
      .join('\n\n');
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          className="cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => setClassesExpanded(!classesExpanded)}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="font-monument">Klasser</CardTitle>
            {classesExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        </CardHeader>
        
        {classesExpanded && (
          <CardContent>
            <ul className="space-y-2">
              {getClassStatistics().map(({ className, slots, count }) => (
                <li key={className} className="flex items-center justify-between border-b border-gray-200 last:border-0 pb-2">
                  <span className="font-medium">{className}</span>
                  <div 
                    className="text-gray-600 cursor-help"
                    title={formatSlotList(slots)}
                  >
                    {count}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader
          className="cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => setTeachersExpanded(!teachersExpanded)}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="font-monument">Lärare</CardTitle>
            {teachersExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        </CardHeader>
        
        {teachersExpanded && (
          <CardContent>
            <ul className="space-y-2">
              {getTeacherStatistics().map(({ teacher, classes, totalCount }) => (
                <li key={teacher} className="flex items-center justify-between border-b border-gray-200 last:border-0 pb-2">
                  <span className="font-medium">{teacher}</span>
                  <div 
                    className="text-gray-600 cursor-help"
                    title={formatTeacherSlots(classes)}
                  >
                    {totalCount}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        )}
      </Card>
    </div>
  );
}