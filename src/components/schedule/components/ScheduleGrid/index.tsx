import React from 'react';
import { ScheduleSlot } from './ScheduleSlot';
import { SlotInfo } from './SlotInfo';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Box, Schedule, Filter, Restriction, HoverInfo } from '../../types';
import { getBoxInSlot, getConflicts, checkRestrictions } from '../../utils/schedule';
import { getScheduleConfig, formatTimeSlot, calculateTimeSlotHeight } from '@/config/scheduleConfig';

interface ScheduleGridProps {
  boxes: Box[];
  schedule: Schedule;
  restrictions: Restriction[];
  filter: Filter;
  draggedBox: Box | null;
  scheduleRef: React.RefObject<HTMLDivElement>;
  onDrop: (day: string, timeSlotId: string, slotIndex: number) => void;
  onSlotClick: (day: string, timeSlotId: string, slotIndex: number) => void;
  onSlotHover: (day: string | null, timeSlotId: string | null) => void;
}

export function ScheduleGrid({
  boxes,
  schedule,
  restrictions,
  filter,
  draggedBox,
  scheduleRef,
  onDrop,
  onSlotClick,
  onSlotHover
}: ScheduleGridProps) {
  const config = getScheduleConfig();
  const { days, timeSlots, slotHeightMultiplier, maxSlotColumns } = config;

  const [hoverInfo, setHoverInfo] = React.useState<HoverInfo>({
    day: null,
    timeSlotId: null,
    slotIndex: null,
    show: false
  });
  
  // Track collapsed days
  const [collapsedDays, setCollapsedDays] = React.useState<Set<string>>(new Set());

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, day: string, timeSlotId: string, slotIndex: number) => {
    e.preventDefault();
    if (!draggedBox) return;

    if (checkRestrictions(draggedBox.id, day, timeSlotId, schedule, boxes, restrictions)) {
      const proceed = window.confirm(
        'Denna placering bryter mot en restriktion. Vill du överskrida den tillfälligt?'
      );
      if (!proceed) return;
    }

    onDrop(day, timeSlotId, slotIndex);
  };

  function getVisibleSlots(day: string, timeSlotId: string): Array<{ slotIndex: number; box: Box | undefined }> {
    const slots: Array<{ slotIndex: number; box: Box | undefined }> = [];
    let lastUsedIndex = -1;
    
    for (let i = 0; i < maxSlotColumns; i++) {
      const box = getBoxInSlot(day, timeSlotId, i, schedule, boxes);
      if (box) {
        slots.push({ slotIndex: i, box });
        lastUsedIndex = i;
      }
    }
    
    if (slots.length > 0 && slots.length < maxSlotColumns) {
      slots.push({ slotIndex: lastUsedIndex + 1, box: undefined });
    }
    
    if (slots.length === 0) {
      slots.push({ slotIndex: 0, box: undefined });
    }
    
    return slots;
  }

  const toggleDayCollapse = (day: string) => {
    setCollapsedDays(prev => {
      const newCollapsed = new Set(prev);
      if (newCollapsed.has(day)) {
        newCollapsed.delete(day);
      } else {
        newCollapsed.add(day);
      }
      return newCollapsed;
    });
  };

  // Calculate widths based on visible days
  const getColumnWidth = (day: string) => {
    if (collapsedDays.has(day)) {
      return '40px'; // Width of collapsed column
    }
    const visibleDays = days.length - collapsedDays.size;
    const percentage = 100 / visibleDays;
    return `${percentage}%`;
  };

  // Calculate the height of a time slot based on its duration
  const getTimeSlotHeight = (timeSlotId: string) => {
    const timeSlot = timeSlots.find(slot => slot.id === timeSlotId);
    if (!timeSlot) return 60; // Default height if slot not found
    
    return calculateTimeSlotHeight(timeSlot.durationMinutes, slotHeightMultiplier);
  };

  return (
    <div 
      ref={scheduleRef} 
      className="schedule-grid mb-8 overflow-x-auto"
      data-html2canvas-ignore-absolute="true"
    >
      <table className="w-full border-collapse table-fixed">
        <thead>
          <tr>
            <th className="schedule-grid-header w-24"></th>
            {days.map((day) => (
              <th 
                key={day} 
                className="schedule-grid-header transition-all duration-300"
                style={{ 
                  width: getColumnWidth(day),
                }}
              >
                <div className="flex items-center justify-between">
                  {!collapsedDays.has(day) ? (
                    <>
                      <span>{day}</span>
                      <button
                        onClick={() => toggleDayCollapse(day)}
                        className="text-white hover:text-gray-200 transition-colors"
                      >
                        <ChevronLeft size={20} />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => toggleDayCollapse(day)}
                      className="w-full text-white hover:text-gray-200 transition-colors"
                      title={day}
                    >
                      <ChevronRight size={20} />
                    </button>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {timeSlots.map((timeSlot) => (
            <tr key={timeSlot.id} style={{ height: `${getTimeSlotHeight(timeSlot.id)}px` }}>
              <td className="schedule-grid-cell font-medium text-gray-700 text-center px-2 py-2 w-28">
                {formatTimeSlot(timeSlot)}
              </td>
              {days.map((day) => {
                const slots = getVisibleSlots(day, timeSlot.id);
                const isCollapsed = collapsedDays.has(day);

                return (
                  <td 
                    key={`${day}-${timeSlot.id}`} 
                    className="schedule-grid-cell relative p-2 transition-all duration-300"
                    style={{ 
                      width: getColumnWidth(day),
                      height: `${getTimeSlotHeight(timeSlot.id)}px`
                    }}
                  >
                    {!isCollapsed && (
                      <div 
                        className="grid gap-2 h-full transition-all duration-200"
                        style={{ gridTemplateColumns: `repeat(${slots.length}, 1fr)` }}
                      >
                        {slots.map(({ slotIndex, box }) => (
                          <React.Fragment key={slotIndex}>
                            <ScheduleSlot
                              day={day}
                              timeSlotId={timeSlot.id}
                              slotIndex={slotIndex}
                              box={box}
                              boxes={boxes}
                              schedule={schedule}
                              restrictions={restrictions}
                              isHighlighted={false}
                              onDragOver={handleDragOver}
                              onDrop={(e) => handleDrop(e, day, timeSlot.id, slotIndex)}
                              onSlotClick={() => onSlotClick(day, timeSlot.id, slotIndex)}
                              onMouseEnter={() => {
                                onSlotHover(day, timeSlot.id);
                                setHoverInfo({ day, timeSlotId: timeSlot.id, slotIndex, show: true });
                              }}
                              onMouseLeave={() => {
                                onSlotHover(null, null);
                                setHoverInfo({ day: null, timeSlotId: null, slotIndex: null, show: false });
                              }}
                            />
                            {hoverInfo.show &&
                              hoverInfo.day === day &&
                              hoverInfo.timeSlotId === timeSlot.id &&
                              hoverInfo.slotIndex === slotIndex &&
                              box && (
                                <SlotInfo
                                  box={box}
                                  conflicts={getConflicts(box.id, day, timeSlot.id, schedule, boxes, restrictions)}
                                  boxes={boxes}
                                />
                              )}
                          </React.Fragment>
                        ))}
                      </div>
                    )}
                    {isCollapsed && (
                      <div className="h-full w-full flex items-center justify-center">
                        <div 
                          className="w-2 h-full rounded"
                          style={{
                            backgroundColor: slots.some(slot => slot.box) ? slots[0].box?.color : '#e5e7eb'
                          }}
                        />
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}