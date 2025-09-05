// src/components/ScheduleGrid.tsx

import React from 'react';
import type { Activity, FamilyMember, Settings } from '../types';
import { ActivityBlock } from './ActivityBlock';
import { calculatePosition, calculateOverlapGroups } from '../utils/scheduleUtils';
import { isToday } from '../utils/dateUtils';

interface ScheduleGridProps {
  days: string[];
  weekDates: Date[];
  timeSlots: string[];
  activities: Activity[];
  familyMembers: FamilyMember[];
  settings: Settings;
  selectedWeek: number;
  selectedYear: number;
  onActivityClick: (activity: Activity) => void;
}

export const ScheduleGrid: React.FC<ScheduleGridProps> = ({
  days,
  weekDates,
  timeSlots,
  activities,
  familyMembers,
  settings,
  selectedWeek,
  selectedYear,
  onActivityClick
}) => {
  const getActivitiesForDay = (day: string) => {
    return activities
      .filter(a => a.day === day && a.week === selectedWeek && a.year === selectedYear)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  };

  // Add overlap intensity levels
  const getOverlapIntensity = (overlapGroups: Activity[][]) => {
    if (overlapGroups.length <= 1) return 'none';
    if (overlapGroups.length === 2) return 'low';
    if (overlapGroups.length <= 3) return 'medium';
    return 'high';
  };

  const monthAbbr = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun',
                     'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

  // Dynamically adjust column width based on overlap intensity
  const columnWidths = days.map(day => {
    const dayActivities = getActivitiesForDay(day);
    const overlapGroups = calculateOverlapGroups(dayActivities);
    const intensity = getOverlapIntensity(overlapGroups);
    
    switch(intensity) {
      case 'high': return '2fr';
      case 'medium': return '1.75fr';
      case 'low': return '1.5fr';
      default: return '1fr';
    }
  });

  const gridTemplateColumns = `80px ${columnWidths.join(' ')}`;

  // Helper function to get visual indicator for busy days
  const getDayIntensityClass = (day: string) => {
    const dayActivities = getActivitiesForDay(day);
    const overlapGroups = calculateOverlapGroups(dayActivities);
    const intensity = getOverlapIntensity(overlapGroups);
    return `day-intensity-${intensity}`;
  };

  return (
    <main className="schedule-container" role="main" aria-label="Veckans schema">
      <div
        className="schedule-grid"
        style={{ gridTemplateColumns: gridTemplateColumns }}
      >
        {/* Time column */}
        <div className="time-column">
          <div className="time-header">TID</div>
          {timeSlots.map(time => (
            <div key={time} className="time-slot">{time}</div>
          ))}
        </div>

        {/* Day columns */}
        {days.map((day, index) => {
          const date = weekDates[index];
          const dayActivities = getActivitiesForDay(day);
          const overlapGroups = calculateOverlapGroups(dayActivities);
          const numColumns = overlapGroups.length;
          const intensity = getOverlapIntensity(overlapGroups);

          return (
            <div key={day} className={`day-column ${getDayIntensityClass(day)}`}>
              <div className={`day-header ${isToday(date) ? 'today' : ''}`}>
                <span className="day-name">{day}</span>
                <span className="day-date">
                  {date.getDate()} {monthAbbr[date.getMonth()]}
                </span>
                {/* Add visual indicator for busy days */}
                {intensity !== 'none' && (
                  <span className={`intensity-indicator intensity-${intensity}`} 
                        title={`${overlapGroups.length} overlapping activities`}>
                    {intensity === 'high' ? '🔥' : intensity === 'medium' ? '⚡' : '📌'}
                  </span>
                )}
              </div>
              <div className="day-content" style={{ height: `${timeSlots.length * 60}px` }}>
                {overlapGroups.map((group, groupIndex) =>
                  group.map(activity => {
                    const { top, height } = calculatePosition(
                      activity.startTime,
                      activity.endTime,
                      60,
                      settings.dayStart
                    );
                    
                    let width: string;
                    let left: string;

                    if (numColumns > 1) {
                        const baseWidth = 100 / numColumns;
                        // 2px margin on each side of the block, creating a 4px gap between blocks
                        width = `calc(${baseWidth}% - 4px)`;
                        left = `calc(${baseWidth * groupIndex}% + 2px)`;
                    } else {
                        // 4px margin on each side for single blocks
                        width = 'calc(100% - 8px)';
                        left = '4px';
                    }

                    // Define props in an object before passing them
                    const activityBlockProps = {
                      activity: activity,
                      day: day,
                      familyMembers: familyMembers,
                      style: {
                        position: 'absolute' as const,
                        top,
                        height,
                        left,
                        width,
                      },
                      onClick: () => onActivityClick(activity),
                      dayIndex: index,
                      totalDays: days.length,
                    };
                    
                    // Spread the props into the component
                    return (
                      <ActivityBlock key={activity.id} {...activityBlockProps} />
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
};