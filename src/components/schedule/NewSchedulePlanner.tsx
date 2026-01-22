'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  useDroppable,
  useDraggable,
  DragOverlay,
  useSensors,
  useSensor,
  PointerSensor,
  KeyboardSensor,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
  Download, RefreshCcw, Trash2, Plus, Edit2, ShieldAlert, Upload, X, BarChart3, Settings
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { generateBoxColor, importColors } from '@/config/colorManagement';
import { PlannerCourse, ScheduledEntry, RestrictionRule, PersistedPlannerState } from '@/types/schedule';
import { 
  START_HOUR, END_HOUR, PIXELS_PER_MINUTE, 
  timeToMinutes, minutesToTime, getPositionStyles, 
  snapTime, checkOverlap, EVENT_GAP_PX, MIN_HEIGHT_PX
} from '@/utils/scheduleTime';

const STORAGE_KEY = 'drive-c-schedule-planner-v5-timeline';
const days = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag'];
const palette = ['#ffffff', '#fde68a', '#bae6fd', '#d9f99d', '#fecdd3', '#c7d2fe', '#a7f3d0', '#ddd6fe', '#fed7aa'];

const baseCourses: PlannerCourse[] = [
  { id: 'c1', title: 'Matematik 1a', teacher: 'L. Holm', duration: 60, color: '#fde68a', category: 'Natur', room: 'A1' },
  { id: 'c2', title: 'Svenska 1', teacher: 'E. Ström', duration: 60, color: '#bae6fd', category: 'Språk', room: 'B2' },
];

// --- Helper: Conflict Check & Filtering ---

const wildcardMatch = (pattern: string, text: string): boolean => {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp('^' + escaped.replace(/\*/g, '.*') + '$', 'i');
  return regex.test(text);
};

const advancedFilterMatch = (item: PlannerCourse | ScheduledEntry, filterQuery: string): boolean => {
  if (!filterQuery.trim()) return true;
  const searchString = `${item.title} ${item.teacher} ${item.room} ${item.category || ''}`.toLowerCase();
  const blocks = filterQuery.toLowerCase().split(';');
  return blocks.some(block => {
    const parts = block.trim().split('+'); 
    return parts.every(part => {
      const p = part.trim();
      if (!p) return true;
      if (p.startsWith('-')) {
        const term = p.substring(1);
        return !searchString.includes(term);
      } else {
        return searchString.includes(p);
      }
    });
  });
};

const validateRestrictions = (
  newEntry: { title: string, day: string, startTime: string, endTime: string, instanceId?: string },
  currentSchedule: ScheduledEntry[],
  rules: RestrictionRule[]
): string | null => {
  const potentialConflicts = currentSchedule.filter(e => 
    e.day === newEntry.day && 
    e.instanceId !== newEntry.instanceId &&
    checkOverlap(newEntry.startTime, newEntry.endTime, e.startTime, e.endTime)
  );

  if (potentialConflicts.length === 0) return null;

  for (const existing of potentialConflicts) {
    for (const rule of rules) {
      const matchA_New = wildcardMatch(rule.subjectA, newEntry.title);
      const matchB_Exist = wildcardMatch(rule.subjectB, existing.title);
      const matchB_New = wildcardMatch(rule.subjectB, newEntry.title);
      const matchA_Exist = wildcardMatch(rule.subjectA, existing.title);

      if ((matchA_New && matchB_Exist) || (matchB_New && matchA_Exist)) {
        return `Krock! "${newEntry.title}" krockar med "${existing.title}" (${existing.startTime}-${existing.endTime}).`;
      }
    }
  }
  return null;
};

// --- Helper: Data Sanitization ---
const sanitizeScheduleImport = (importedSchedule: any[]): ScheduledEntry[] => {
  if (!Array.isArray(importedSchedule)) return [];
  
  return importedSchedule.map(entry => {
    const start = entry.startTime || "08:00";
    const end = entry.endTime || minutesToTime(timeToMinutes(start) + 60);
    
    let duration = entry.duration;
    if (!duration || isNaN(duration)) {
      duration = timeToMinutes(end) - timeToMinutes(start);
    }

    return {
      ...entry,
      instanceId: entry.instanceId || uuidv4(),
      startTime: start,
      endTime: end,
      duration: duration > 0 ? duration : 60, 
      day: days.includes(entry.day) ? entry.day : days[0] 
    };
  });
};

// --- Sub-Components ---

function DraggableSourceCard({ course, onEdit, onDelete, hidden }: { course: PlannerCourse; onEdit: (c: PlannerCourse) => void; onDelete: (id: string) => void; hidden?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `source-${course.id}`,
    data: { type: 'course', course },
  });

  if (hidden) return null;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ backgroundColor: course.color }}
      className={`relative group p-2 mb-2 rounded border border-black/10 cursor-grab hover:shadow-md transition-all ${isDragging ? 'opacity-50' : ''}`}
    >
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-bold">{course.title}</p>
          <p className="text-[10px] text-gray-600">{course.teacher} {course.room && `(${course.room})`}</p>
          <p className="text-[10px] text-gray-500">{course.duration} min</p>
        </div>
      </div>
      <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onPointerDown={e => e.stopPropagation()} onClick={() => onEdit(course)} className="p-1 bg-white/50 hover:bg-white rounded-full"><Edit2 size={10} /></button>
        <button onPointerDown={e => e.stopPropagation()} onClick={() => onDelete(course.id)} className="p-1 bg-white/50 hover:bg-rose-200 rounded-full text-rose-700"><Trash2 size={10} /></button>
      </div>
    </div>
  );
}

function ScheduledEventCard({
  entry,
  onEdit,
  onRemove,
  onContextMenu,
  hidden,
  columnIndex,
  columnCount,
  isLastOfDay
}: {
  entry: ScheduledEntry;
  onEdit: (e: ScheduledEntry) => void;
  onRemove: (id: string) => void;
  onContextMenu: (event: React.MouseEvent<HTMLDivElement>, e: ScheduledEntry) => void;
  hidden?: boolean;
  columnIndex: number;
  columnCount: number;
  isLastOfDay: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: entry.instanceId,
    data: { type: 'scheduled', entry },
  });

  const { top, height } = getPositionStyles(entry.startTime, entry.duration);
  const adjustedTop = top + EVENT_GAP_PX / 2;
  const adjustedHeight = Math.max(height - EVENT_GAP_PX, MIN_HEIGHT_PX);
  const widthPercentage = 100 / Math.max(columnCount, 1);
  const leftPercentage = widthPercentage * columnIndex;

  if (hidden) return null;

  const isShortDuration = entry.duration < 50;
  const timeLabel = isLastOfDay ? `${entry.startTime}–${entry.endTime}` : entry.startTime;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onContextMenu={(event) => onContextMenu(event, entry)}
      style={{ 
        position: 'absolute',
        top: `${adjustedTop}px`,
        height: `${adjustedHeight}px`,
        left: `calc(${leftPercentage}% + 4px)`,
        width: `calc(${widthPercentage}% - 8px)`,
        backgroundColor: entry.color,
        zIndex: isDragging ? 50 : 10
      }}
      className={`rounded border border-black/20 shadow-sm overflow-hidden p-1 group cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-60 ring-2 ring-black' : ''}`}
      title={`${entry.duration} min • ${entry.startTime} – ${entry.endTime}`}
    >
      <div className="flex flex-col h-full">
        <div className="flex justify-between items-start">
          <span className="text-[10px] font-mono font-bold opacity-70 leading-none">
            {timeLabel}
            {isShortDuration && (
              <span className="ml-1 font-sans font-bold">{entry.title}</span>
            )}
          </span>
          <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 bg-white/60 rounded">
             <button onPointerDown={e => e.stopPropagation()} onClick={() => onEdit(entry)} className="p-0.5 hover:bg-white rounded"><Edit2 size={8}/></button>
             <button onPointerDown={e => e.stopPropagation()} onClick={() => onRemove(entry.instanceId)} className="p-0.5 hover:bg-rose-200 text-rose-600 rounded"><Trash2 size={8}/></button>
          </div>
        </div>
        {!isShortDuration && <p className="text-xs font-bold leading-tight truncate">{entry.title}</p>}
        {adjustedHeight > 30 && (
           <p className="text-[10px] text-gray-700 truncate">{entry.teacher} {entry.room}</p>
        )}
      </div>
    </div>
  );
}

function DayColumn({ day, ghost, children }: { day: string; ghost: {
  startTime: string;
  endTime: string;
  duration: number;
  color: string;
  title: string;
} | null; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: day,
    data: { day }
  });

  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
  const ghostStyles = ghost ? getPositionStyles(ghost.startTime, ghost.duration) : null;

  return (
    <div 
      ref={setNodeRef}
      className={`relative flex-1 min-w-[140px] border-r border-gray-200 bg-white transition-colors ${isOver ? 'bg-blue-50' : ''}`}
      style={{ height: `${(END_HOUR - START_HOUR) * 60 * PIXELS_PER_MINUTE}px` }}
    >
       <div className={`absolute -top-4 left-0 right-0 h-4 border-r border-gray-200 ${isOver ? 'bg-blue-50' : 'bg-white'}`} />
       {hours.map(h => (
         <div key={h} 
           className="absolute w-full border-t border-gray-100"
           style={{ top: `${(h - START_HOUR) * 60 * PIXELS_PER_MINUTE}px` }}
         />
       ))}
       {ghost && ghostStyles && (
         <>
           <div
             className="absolute left-0 right-0 border-t border-dashed z-[5]"
             style={{ top: `${ghostStyles.top}px`, borderColor: ghost.color }}
           />
           <div
             className="absolute rounded border-2 border-dashed text-blue-900/80 px-1 py-0.5 z-[6] pointer-events-none opacity-70"
             style={{
               top: `${ghostStyles.top}px`,
               height: `${Math.max(ghostStyles.height - EVENT_GAP_PX, MIN_HEIGHT_PX)}px`,
               left: '6px',
               right: '6px',
               borderColor: ghost.color,
               backgroundColor: ghost.color
             }}
           >
             <div className="text-[10px] font-mono font-bold opacity-70 leading-none">{ghost.startTime}–{ghost.endTime}</div>
             <div className="text-xs font-bold truncate">{ghost.title}</div>
           </div>
         </>
       )}
       {children}
    </div>
  );
}

const buildDayLayout = (entries: ScheduledEntry[]) => {
  const groups: ScheduledEntry[][] = [];

  entries.forEach(entry => {
    const overlappingGroups = groups.filter(group =>
      group.some(existing =>
        checkOverlap(entry.startTime, entry.endTime, existing.startTime, existing.endTime)
      )
    );

    if (overlappingGroups.length === 0) {
      groups.push([entry]);
      return;
    }

    const mergedGroup = overlappingGroups.flat();
    overlappingGroups.forEach(group => {
      const index = groups.indexOf(group);
      if (index > -1) {
        groups.splice(index, 1);
      }
    });
    groups.push([...mergedGroup, entry]);
  });

  const layout = new Map<string, { column: number; columns: number }>();

  groups.forEach(group => {
    const sorted = [...group].sort((a, b) => {
      const startDiff = timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
      if (startDiff !== 0) return startDiff;
      return timeToMinutes(a.endTime) - timeToMinutes(b.endTime);
    });

    const columns: ScheduledEntry[][] = [];

    sorted.forEach(entry => {
      let placed = false;
      for (let i = 0; i < columns.length; i += 1) {
        const last = columns[i][columns[i].length - 1];
        if (!checkOverlap(last.startTime, last.endTime, entry.startTime, entry.endTime)) {
          columns[i].push(entry);
          layout.set(entry.instanceId, { column: i, columns: 0 });
          placed = true;
          break;
        }
      }
      if (!placed) {
        columns.push([entry]);
        layout.set(entry.instanceId, { column: columns.length - 1, columns: 0 });
      }
    });

    const totalColumns = columns.length;
    columns.forEach((columnEntries, columnIndex) => {
      columnEntries.forEach(entry => {
        layout.set(entry.instanceId, { column: columnIndex, columns: totalColumns });
      });
    });
  });

  return layout;
};

// --- Main Component ---

export default function NewSchedulePlanner() {
  const [courses, setCourses] = useState<PlannerCourse[]>(baseCourses);
  const [schedule, setSchedule] = useState<ScheduledEntry[]>([]);
  const [restrictions, setRestrictions] = useState<RestrictionRule[]>([]);
  const scheduleHistoryRef = useRef<ScheduledEntry[][]>([]);
  const scheduleFutureRef = useRef<ScheduledEntry[][]>([]);
  
  // UI State
  const [filterQuery, setFilterQuery] = useState("");
  const [manualColor, setManualColor] = useState(false);
  
  // Modals
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<PlannerCourse | null>(null);
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ScheduledEntry | null>(null);
  const [isRestrictionsModalOpen, setIsRestrictionsModalOpen] = useState(false);
  const [newRule, setNewRule] = useState<RestrictionRule>({ id: '', subjectA: '', subjectB: '' });
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    entry: ScheduledEntry;
  } | null>(null);

  const [activeDragItem, setActiveDragItem] = useState<any>(null);
  const [ghostPlacement, setGhostPlacement] = useState<{
    day: string;
    startTime: string;
    endTime: string;
    duration: number;
    color: string;
    title: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  // Load/Save LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setCourses(parsed.courses || baseCourses);
        if (parsed.schedule) {
          setSchedule(sanitizeScheduleImport(parsed.schedule));
        }
        setRestrictions(parsed.restrictions || []);
        scheduleHistoryRef.current = [];
        scheduleFutureRef.current = [];
      } catch (e) { console.error("Load failed", e); }
    }
  }, []);

  useEffect(() => {
    const payload: PersistedPlannerState = { version: 5, timestamp: new Date().toISOString(), courses, schedule, restrictions };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [courses, schedule, restrictions]);

  // Sync colors
  useEffect(() => {
    const colorMap = courses.map(c => ({ className: c.title, color: c.color }));
    importColors(colorMap);
  }, [courses]);

  // Statistics
  const scheduleStats = useMemo(() => {
    const stats: Record<string, number> = {};
    const visibleSchedule = schedule.filter(entry => advancedFilterMatch(entry, filterQuery));
    visibleSchedule.forEach(entry => {
      if (!stats[entry.title]) stats[entry.title] = 0;
      stats[entry.title] += entry.duration;
    });
    return Object.entries(stats).sort((a, b) => b[1] - a[1]);
  }, [schedule, filterQuery]);

  const hoursFormatter = useMemo(() => new Intl.NumberFormat('sv-SE', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }), []);

  const layoutByDay = useMemo(() => {
    const layout: Record<string, Map<string, { column: number; columns: number }>> = {};
    days.forEach(day => {
      const entries = schedule.filter(entry => entry.day === day);
      layout[day] = buildDayLayout(entries);
    });
    return layout;
  }, [schedule]);

  // --- JSON Import/Export Handlers ---

  const handleExportJSON = () => {
    const dataToSave: PersistedPlannerState = {
      version: 5,
      timestamp: new Date().toISOString(),
      courses,
      schedule,
      restrictions
    };
    const blob = new Blob([JSON.stringify(dataToSave, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `schema-backup-v5-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);
        if (parsed.courses && parsed.schedule) {
          if (confirm('Ersätta nuvarande schema?')) {
            setCourses(parsed.courses);
            const sanitizedSchedule = sanitizeScheduleImport(parsed.schedule);
            commitSchedule(() => sanitizedSchedule);
            if (parsed.restrictions) setRestrictions(parsed.restrictions);
          }
        } else {
          alert('Ogiltig filstruktur.');
        }
      } catch (error) {
        alert('Kunde inte läsa filen.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };


  // --- Drag & Drop Logic ---

  const handleDragStart = (event: any) => {
    setActiveDragItem(event.active.data.current);
  };

  const commitSchedule = useCallback((updater: (prev: ScheduledEntry[]) => ScheduledEntry[]) => {
    setSchedule(prev => {
      const next = updater(prev);
      if (next !== prev) {
        scheduleHistoryRef.current = [...scheduleHistoryRef.current, prev];
        scheduleFutureRef.current = [];
      }
      return next;
    });
  }, []);

  const handleUndo = useCallback(() => {
    const history = scheduleHistoryRef.current;
    if (history.length === 0) return;
    setSchedule(prev => {
      const previous = history[history.length - 1];
      scheduleHistoryRef.current = history.slice(0, -1);
      scheduleFutureRef.current = [...scheduleFutureRef.current, prev];
      return previous;
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditable = target?.tagName === 'INPUT'
        || target?.tagName === 'TEXTAREA'
        || target?.isContentEditable;
      if (isEditable) return;

      const isUndoKey = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z';
      if (!isUndoKey || event.shiftKey) return;

      event.preventDefault();
      handleUndo();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo]);

  useEffect(() => {
    if (!contextMenu) return;

    const handleDismiss = () => setContextMenu(null);
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenu(null);
      }
    };

    window.addEventListener('click', handleDismiss);
    window.addEventListener('contextmenu', handleDismiss);
    window.addEventListener('keydown', handleEsc);

    return () => {
      window.removeEventListener('click', handleDismiss);
      window.removeEventListener('contextmenu', handleDismiss);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [contextMenu]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragItem(null);
    setGhostPlacement(null);

    if (!over) return;

    const targetDay = over.id as string;
    const type = active.data.current?.type;
    const overRect = over.rect;
    const activeRect = active.rect.current?.translated;

    if (!activeRect || !overRect) return;

    const itemDuration = type === 'course' 
      ? (active.data.current?.course.duration || 60) 
      : active.data.current?.entry.duration;

    const relativeY = activeRect.top - overRect.top;
    let minutesFromStart = relativeY / PIXELS_PER_MINUTE;
    let totalMinutes = (START_HOUR * 60) + minutesFromStart;
    
    // Snap & Constraints
    totalMinutes = snapTime(totalMinutes);
    const minTime = START_HOUR * 60;
    
    // Fix: Dra av duration från maxTime
    const maxTime = (END_HOUR * 60) - itemDuration;
    
    totalMinutes = Math.max(minTime, Math.min(totalMinutes, maxTime));

    const newStartTime = minutesToTime(totalMinutes);
    const endMinutes = totalMinutes + itemDuration;
    const newEndTime = minutesToTime(endMinutes);

    if (type === 'course') {
      const course = active.data.current?.course as PlannerCourse;
      
      const conflict = validateRestrictions(
        { title: course.title, day: targetDay, startTime: newStartTime, endTime: newEndTime },
        schedule,
        restrictions
      );
      if (conflict) { alert(conflict); return; }

      const newEntry: ScheduledEntry = {
        ...course,
        instanceId: uuidv4(),
        day: targetDay,
        startTime: newStartTime,
        endTime: newEndTime,
        duration: itemDuration
      };
      commitSchedule(prev => [...prev, newEntry]);

    } else if (type === 'scheduled') {
      const entry = active.data.current?.entry as ScheduledEntry;

      const conflict = validateRestrictions(
        { title: entry.title, day: targetDay, startTime: newStartTime, endTime: newEndTime, instanceId: entry.instanceId },
        schedule,
        restrictions
      );
      if (conflict) { alert(conflict); return; }

      commitSchedule(prev => prev.map(e => 
        e.instanceId === entry.instanceId 
          ? { ...e, day: targetDay, startTime: newStartTime, endTime: newEndTime } 
          : e
      ));
    }
  };

  const handleDragMove = (event: any) => {
    const { active, over } = event;

    if (!over) {
      setGhostPlacement(null);
      return;
    }

    const targetDay = over.id as string;
    const type = active.data.current?.type;
    const overRect = over.rect;
    const activeRect = active.rect.current?.translated;

    if (!activeRect || !overRect) {
      setGhostPlacement(null);
      return;
    }

    const itemDuration = type === 'course' 
      ? (active.data.current?.course.duration || 60) 
      : active.data.current?.entry.duration;

    const relativeY = activeRect.top - overRect.top;
    let minutesFromStart = relativeY / PIXELS_PER_MINUTE;
    let totalMinutes = (START_HOUR * 60) + minutesFromStart;

    totalMinutes = snapTime(totalMinutes);
    const minTime = START_HOUR * 60;
    const maxTime = (END_HOUR * 60) - itemDuration;
    totalMinutes = Math.max(minTime, Math.min(totalMinutes, maxTime));

    const newStartTime = minutesToTime(totalMinutes);
    const endMinutes = totalMinutes + itemDuration;
    const newEndTime = minutesToTime(endMinutes);

    if (type === 'course') {
      const course = active.data.current?.course as PlannerCourse;
      setGhostPlacement({
        day: targetDay,
        startTime: newStartTime,
        endTime: newEndTime,
        duration: itemDuration,
        color: course.color,
        title: course.title
      });
      return;
    }

    if (type === 'scheduled') {
      const entry = active.data.current?.entry as ScheduledEntry;
      setGhostPlacement({
        day: targetDay,
        startTime: newStartTime,
        endTime: newEndTime,
        duration: itemDuration,
        color: entry.color,
        title: entry.title
      });
    }
  };

  const handleDragCancel = () => {
    setActiveDragItem(null);
    setGhostPlacement(null);
  };

  // --- CRUD Handlers ---

  const handleDeleteCourse = (id: string) => {
     if(confirm("Ta bort?")) setCourses(p => p.filter(c => c.id !== id));
  };
  const handleSaveCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if(!editingCourse) return;
    setCourses(p => {
       const exists = p.find(c => c.id === editingCourse.id);
       return exists ? p.map(c => c.id === editingCourse.id ? editingCourse : c) : [...p, editingCourse];
    });
    setIsCourseModalOpen(false);
  };
  
  const handleSaveEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if(!editingEntry) return;

    const startMin = timeToMinutes(editingEntry.startTime);
    const endMin = timeToMinutes(editingEntry.endTime);
    
    if (endMin <= startMin) {
        alert("Sluttid måste vara efter starttid!");
        return;
    }

    const newDuration = endMin - startMin;

    const conflict = validateRestrictions(
        { 
            title: editingEntry.title, 
            day: editingEntry.day, 
            startTime: editingEntry.startTime, 
            endTime: editingEntry.endTime, 
            instanceId: editingEntry.instanceId 
        },
        schedule,
        restrictions
    );

    if (conflict) {
        alert(conflict);
        return;
    }
    
    commitSchedule(p => p.map(entry => entry.instanceId === editingEntry.instanceId ? {...editingEntry, duration: newDuration} : entry));
    setIsEntryModalOpen(false);
  };

  const handleExportPDF = async () => {
    const el = document.getElementById('schedule-canvas');
    if(!el) return;
    const canvas = await html2canvas(el, { scale: 2 });
    const pdf = new jsPDF('l', 'pt', 'a4');
    const imgProps = pdf.getImageProperties(canvas.toDataURL('image/png'));
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 20, pdfWidth, pdfHeight);
    pdf.save('schema.pdf');
  };

  // --- Render ---

  return (
    <DndContext 
      sensors={sensors} 
      onDragStart={handleDragStart} 
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="space-y-6 pb-20">
        
        {/* Toolbar & Filter */}
        <div className="rounded-xl border-2 border-black bg-white p-4 shadow-[4px_4px_0px_rgba(0,0,0,1)] flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
           <div>
              <h1 className="font-monument text-xl">FlexSchema <span className="text-xs font-sans font-normal text-gray-500">v5 Timeline</span></h1>
              <p className="text-sm text-gray-600">Dra och släpp på tidslinjen.</p>
           </div>
           
           <div className="flex-1 max-w-md w-full relative">
              <Input 
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Filter: matte + hanna; -eng..."
                className="border-2 border-black shadow-sm pl-10"
              />
              <div className="absolute left-3 top-2.5 text-gray-400">🔍</div>
           </div>

           <div className="flex gap-2 flex-wrap">
              <Button variant="neutral" onClick={() => setIsRestrictionsModalOpen(true)} className="border-2 border-black bg-amber-100 hover:bg-amber-200"><ShieldAlert size={16} className="mr-2"/> Regler</Button>
              <Button variant="neutral" onClick={handleExportPDF} className="border-2 border-black"><Download size={16} className="mr-2"/> PDF</Button>
              <input type="file" accept=".json" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImportJSON} />
              <Button variant="neutral" onClick={handleExportJSON} className="border-2 border-black bg-blue-100 hover:bg-blue-200"><Download size={16} className="mr-2"/> Spara</Button>
              <Button variant="neutral" onClick={() => fileInputRef.current?.click()} className="border-2 border-black bg-blue-100 hover:bg-blue-200"><Upload size={16} className="mr-2"/> Ladda</Button>
              <Button variant="neutral" onClick={() => {if(confirm('Rensa?')) commitSchedule(() => [])}} className="border-2 border-black bg-rose-100 text-rose-800"><RefreshCcw size={16} className="mr-2"/> Rensa</Button>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[1100px]">
          
          {/* Sidebar */}
          <div className="lg:col-span-1 flex flex-col gap-4 h-full">
             <div className="rounded-xl border-2 border-black bg-white p-4 shadow-[4px_4px_0px_rgba(0,0,0,1)] flex-1 overflow-hidden flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="font-bold flex items-center gap-2"><Settings size={18}/> Byggstenar</h2>
                  <Button size="sm" onClick={() => { 
                    setManualColor(false);
                    setEditingCourse({ id: uuidv4(), title: '', teacher: '', room: '', color: '#ffffff', duration: 60 }); 
                    setIsCourseModalOpen(true); 
                  }} className="h-8 w-8 p-0 rounded-full border-2 border-black bg-[#aee8fe]"><Plus size={16}/></Button>
                </div>
                
                {/* Courses List */}
                <div className="overflow-y-auto flex-1 pr-2">
                   {courses.map(c => (
                     <DraggableSourceCard 
                       key={c.id} 
                       course={c} 
                       onEdit={(c) => { setManualColor(true); setEditingCourse(c); setIsCourseModalOpen(true); }} 
                       onDelete={handleDeleteCourse} 
                       hidden={!advancedFilterMatch(c, filterQuery)}
                     />
                   ))}
                </div>

                {/* Statistics */}
                <div className="mt-4 pt-4 border-t-2 border-gray-100">
                  <div className="flex items-center gap-2 mb-2 text-gray-500">
                    <BarChart3 size={14} /> 
                    <span className="text-xs font-bold uppercase">Tid (Filtrerat)</span>
                  </div>
                  <div className="space-y-1 text-xs max-h-[100px] overflow-y-auto">
                    {scheduleStats.length === 0 ? <span className="text-gray-400 italic">Inget schemalagt</span> : 
                      scheduleStats.slice(0, 10).map(([title, minutes]) => {
                        const hours = minutes / 60;
                        return (
                          <div key={title} className="flex justify-between">
                            <span>{title}</span>
                            <span className="font-mono font-bold">{hoursFormatter.format(hours)} h</span>
                          </div>
                        );
                      })
                    }
                  </div>
                </div>

             </div>
          </div>

          {/* Main Schedule Area */}
          <div className="lg:col-span-3 rounded-xl border-2 border-black bg-gray-50 overflow-hidden shadow-[4px_4px_0px_rgba(0,0,0,1)] flex flex-col h-full">
             <div className="flex pl-[50px] border-b-2 border-black bg-white">
                {days.map(day => (
                  <div key={day} className="flex-1 py-2 text-center font-bold text-sm border-r border-gray-200 last:border-0">{day}</div>
                ))}
             </div>

             <div className="flex-1 overflow-y-auto relative" id="schedule-canvas">
                {/* VIKTIGT: pt-4 HÄR gör att 08:00 texten syns! */}
                <div className="flex min-h-full pt-4">
                   <div className="w-[50px] flex-shrink-0 bg-gray-100 relative">
                      <div className="absolute -top-4 left-0 right-0 h-4 bg-gray-100" />
                      {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i).map(h => (
                        <div key={h} className="absolute w-full text-right pr-1 text-xs font-bold text-gray-500 -mt-2"
                             style={{ top: `${(h - START_HOUR) * 60 * PIXELS_PER_MINUTE}px` }}>
                           {h}:00
                        </div>
                      ))}
                   </div>

                   {days.map(day => (
                     <DayColumn key={day} day={day} ghost={ghostPlacement?.day === day ? ghostPlacement : null}>
                        {(() => {
                          const dayEntries = schedule.filter(e => e.day === day);
                          const lastEndTime = dayEntries.reduce((latest, entry) => {
                            const endMinutes = timeToMinutes(entry.endTime);
                            return Math.max(latest, endMinutes);
                          }, -Infinity);

                          return dayEntries.map(entry => {
                          const layout = layoutByDay[day]?.get(entry.instanceId);
                          const columnIndex = layout?.column ?? 0;
                          const columnCount = layout?.columns ?? 1;
                          return (
                           <ScheduledEventCard 
                             key={entry.instanceId} 
                             entry={entry} 
                             onEdit={(e) => { setEditingEntry(e); setIsEntryModalOpen(true); }}
                             onRemove={(id) => commitSchedule(p => p.filter(e => e.instanceId !== id))}
                             onContextMenu={(event, selectedEntry) => {
                               event.preventDefault();
                               setContextMenu({
                                 x: event.clientX,
                                 y: event.clientY,
                                 entry: selectedEntry
                               });
                             }}
                             hidden={!advancedFilterMatch(entry, filterQuery)}
                              columnIndex={columnIndex}
                              columnCount={columnCount}
                              isLastOfDay={timeToMinutes(entry.endTime) === lastEndTime}
                           />
                          );
                          });
                        })()}
                     </DayColumn>
                   ))}
                </div>
             </div>
          </div>
        </div>
      </div>

      <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.5' } } }) }}>
        {activeDragItem?.type === 'course' && (
          <div className="w-[120px] h-[60px] bg-white border-2 border-black p-2 rounded shadow-xl opacity-80" style={{backgroundColor: activeDragItem.course.color}}>
             {activeDragItem.course.title}
          </div>
        )}
        {activeDragItem?.type === 'scheduled' && (
           <div className="w-[120px] bg-white border-2 border-black p-1 rounded shadow-xl opacity-80" 
             style={{ height: `${Math.max(activeDragItem.entry.duration * PIXELS_PER_MINUTE - EVENT_GAP_PX, MIN_HEIGHT_PX)}px`, backgroundColor: activeDragItem.entry.color }}>
              {activeDragItem.entry.title}
           </div>
        )}
      </DragOverlay>

      {contextMenu && (
        <div
          className="fixed z-[100] min-w-[140px] rounded border-2 border-black bg-white shadow-lg"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
            onClick={() => {
              setEditingEntry(contextMenu.entry);
              setIsEntryModalOpen(true);
              setContextMenu(null);
            }}
          >
            Redigera
          </button>
          <button
            className="w-full px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50"
            onClick={() => {
              commitSchedule(p => p.filter(e => e.instanceId !== contextMenu.entry.instanceId));
              setContextMenu(null);
            }}
          >
            Radera
          </button>
        </div>
      )}

      {/* Modals */}
      <Dialog open={isCourseModalOpen} onOpenChange={setIsCourseModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Hantera ämne</DialogTitle></DialogHeader>
          {editingCourse && (
            <form onSubmit={handleSaveCourse} className="space-y-3">
               <Label>Titel</Label> 
               <Input value={editingCourse.title} onChange={e => {
                   const val = e.target.value;
                   let col = editingCourse.color;
                   if(!manualColor && val.length > 1) col = generateBoxColor(val);
                   setEditingCourse({...editingCourse, title: val, color: col});
               }} autoFocus/>
               <Label>Standardlängd (min)</Label> <Input type="number" value={editingCourse.duration} onChange={e => setEditingCourse({...editingCourse, duration: parseInt(e.target.value)})} />
               <div className="grid grid-cols-2 gap-2">
                 <div><Label>Lärare</Label><Input value={editingCourse.teacher} onChange={e => setEditingCourse({...editingCourse, teacher: e.target.value})} /></div>
                 <div><Label>Rum</Label><Input value={editingCourse.room} onChange={e => setEditingCourse({...editingCourse, room: e.target.value})} /></div>
               </div>
               <div className="flex gap-2 mt-2">{palette.map(c => <div key={c} onClick={() => { setManualColor(true); setEditingCourse({...editingCourse, color: c}); }} className={`w-6 h-6 rounded-full cursor-pointer border ${editingCourse.color === c ? 'ring-2 ring-black' : ''}`} style={{backgroundColor: c}} />)}</div>
               <DialogFooter><Button type="submit">Spara</Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
      
      <Dialog open={isEntryModalOpen} onOpenChange={setIsEntryModalOpen}>
        <DialogContent>
           <DialogHeader><DialogTitle>Redigera Tid</DialogTitle></DialogHeader>
           {editingEntry && (
             <form onSubmit={handleSaveEntry} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Start</Label><Input type="time" value={editingEntry.startTime} onChange={e => setEditingEntry({...editingEntry, startTime: e.target.value})} /></div>
                  <div><Label>Slut</Label><Input type="time" value={editingEntry.endTime} onChange={e => setEditingEntry({...editingEntry, endTime: e.target.value})} /></div>
                </div>
                <Label>Rum</Label><Input value={editingEntry.room} onChange={e => setEditingEntry({...editingEntry, room: e.target.value})} />
                <div className="flex gap-2 mt-2">{palette.map(c => <div key={c} onClick={() => setEditingEntry({...editingEntry, color: c})} className={`w-6 h-6 rounded-full cursor-pointer border ${editingEntry.color === c ? 'ring-2 ring-black' : ''}`} style={{backgroundColor: c}} />)}</div>
                <DialogFooter><Button type="submit">Uppdatera</Button></DialogFooter>
             </form>
           )}
        </DialogContent>
      </Dialog>
      
      <Dialog open={isRestrictionsModalOpen} onOpenChange={setIsRestrictionsModalOpen}>
         <DialogContent><DialogHeader><DialogTitle>Regler</DialogTitle></DialogHeader>
            <div className="space-y-2">
               <div className="flex gap-2"><Input placeholder="Matte*" value={newRule.subjectA} onChange={e => setNewRule({...newRule, subjectA: e.target.value})} /><Input placeholder="Svenska*" value={newRule.subjectB} onChange={e => setNewRule({...newRule, subjectB: e.target.value})} /><Button onClick={() => { if(newRule.subjectA && newRule.subjectB) setRestrictions([...restrictions, {...newRule, id: uuidv4()}]) }}>+</Button></div>
               {restrictions.map(r => <div key={r.id} className="flex justify-between text-sm p-2 bg-gray-50 rounded"><span>{r.subjectA} ⚡ {r.subjectB}</span><X size={14} className="cursor-pointer" onClick={() => setRestrictions(restrictions.filter(x => x.id !== r.id))}/></div>)}
            </div>
         </DialogContent>
      </Dialog>

    </DndContext>
  );
}
