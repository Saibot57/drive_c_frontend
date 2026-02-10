'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
  Archive,
  Download,
  RefreshCcw,
  Trash2,
  Plus,
  Edit2,
  ShieldAlert,
  Upload,
  X,
  BarChart3,
  Settings,
  Save,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  CloudUpload,
  FileText
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { generateBoxColor, importColors } from '@/config/colorManagement';
import { isVectorPdfExportEnabled } from '@/config/featureFlags';
import { PlannerActivity, PlannerCourse, ScheduledEntry, RestrictionRule, PersistedPlannerState } from '@/types/schedule';
import { plannerService } from '@/services/plannerService';
import { 
  START_HOUR, END_HOUR, PIXELS_PER_MINUTE, 
  timeToMinutes, minutesToTime, getPositionStyles, 
  snapTime, checkOverlap, EVENT_GAP_PX, MIN_HEIGHT_PX
} from '@/utils/scheduleTime';
import { buildDayLayout } from '@/utils/scheduleLayout';
import { exportElementToVectorPdf } from '@/utils/vectorPdfExport';

const days = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag'];
const palette = ['#ffffff', '#fde68a', '#bae6fd', '#d9f99d', '#fecdd3', '#c7d2fe', '#a7f3d0', '#ddd6fe', '#fed7aa'];
const MANUAL_COURSES_STORAGE_KEY = 'planner_manual_courses_v1';
const DERIVED_COURSE_PREFIX = 'gen_';
const TEACHERS_STORAGE_KEY = 'app.teachers.v1';
const ROOMS_STORAGE_KEY = 'app.rooms.v1';

const baseCourses: PlannerCourse[] = [];

// --- Helper: Derived Courses ---
const normalizeCoursePart = (value?: string) => (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

const buildCourseDedupeKey = (course: Pick<PlannerCourse, 'title' | 'teacher' | 'room' | 'duration' | 'color' | 'category'>) => (
  [
    normalizeCoursePart(course.title),
    normalizeCoursePart(course.teacher),
    normalizeCoursePart(course.room),
    course.duration,
    normalizeCoursePart(course.color),
    normalizeCoursePart(course.category)
  ].join('|') // Dedupe key to keep schedule-derived courses stable.
);

const hashStringFnv1a = (value: string) => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
};

const extractUrl = (value?: string) => {
  if (!value) return null;
  const match = value.match(/https?:\/\/[^\s]+/i);
  return match ? match[0] : null;
};

const deriveCoursesFromSchedule = (scheduleEntries: ScheduledEntry[]) => {
  const unique = new Map<string, PlannerCourse>();

  scheduleEntries.forEach(entry => {
    const mappedCourse: PlannerCourse = {
      id: '',
      title: entry.title ?? '',
      teacher: '',
      room: '',
      duration: entry.duration ?? 60,
      color: entry.color ?? generateBoxColor(entry.title ?? ''),
      category: undefined
    };
    const dedupeKey = buildCourseDedupeKey(mappedCourse);
    if (unique.has(dedupeKey)) return;
    // Deterministic ID based on the dedupe key so derived courses stay stable across reloads.
    mappedCourse.id = `${DERIVED_COURSE_PREFIX}${hashStringFnv1a(dedupeKey)}`;
    unique.set(dedupeKey, mappedCourse);
  });

  return Array.from(unique.values()).sort((a, b) => a.title.localeCompare(b.title, 'sv'));
};

const sanitizeManualCourses = (input: unknown): PlannerCourse[] => {
  if (!Array.isArray(input)) return [];
  return input.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const raw = item as Partial<PlannerCourse>;
    if (typeof raw.id !== 'string' || typeof raw.title !== 'string') return [];
    return [{
      id: raw.id,
      title: raw.title,
      teacher: typeof raw.teacher === 'string' ? raw.teacher : '',
      room: typeof raw.room === 'string' ? raw.room : '',
      color: typeof raw.color === 'string' ? raw.color : '#ffffff',
      duration: typeof raw.duration === 'number' && !Number.isNaN(raw.duration) ? raw.duration : 60,
      category: typeof raw.category === 'string' ? raw.category : undefined
    }];
  });
};

const mergeCourses = (manual: PlannerCourse[], derived: PlannerCourse[]) => {
  const merged = new Map<string, PlannerCourse>();
  manual.forEach(course => merged.set(buildCourseDedupeKey(course), course));
  // Manual courses win when keys collide with derived ones.
  derived.forEach(course => {
    const key = buildCourseDedupeKey(course);
    if (!merged.has(key)) merged.set(key, course);
  });
  return Array.from(merged.values()).sort((a, b) => a.title.localeCompare(b.title, 'sv'));
};

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

const normalizeAutofillValue = (value: string) => (
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
);

const sanitizeHiddenList = (input: string) => {
  const lines = input
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  return lines.filter(line => {
    const key = line.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

function SmartTextInput({
  options,
  value,
  onChange,
  minChars = 2,
  fieldId,
  label,
  placeholder
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  minChars?: number;
  fieldId: string;
  label: string;
  placeholder?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [autoDisabled, setAutoDisabled] = useState(false);
  const backspaceJustPressedRef = useRef(false);
  const lastAutofillAtRef = useRef<number | null>(null);
  const lastAutofillValueRef = useRef<string | null>(null);
  const lastTypedPrefixLengthRef = useRef<number | null>(null);
  const pendingSelectionRef = useRef<{ start: number; end: number } | null>(null);
  const suffixSelectionRef = useRef(false);

  const normalizedOptions = useMemo(() => (
    options.map(option => ({
      raw: option,
      normalized: normalizeAutofillValue(option)
    }))
  ), [options]);

  useEffect(() => {
    const query = normalizeAutofillValue(value);
    if (autoDisabled) return;
    if (backspaceJustPressedRef.current) {
      backspaceJustPressedRef.current = false;
      return;
    }
    if (query.length < minChars) return;
    const matches = normalizedOptions.filter(option => option.normalized.startsWith(query));
    if (matches.length !== 1) return;
    const match = matches[0].raw;
    if (value === match) return;
    const prefixLength = value.length;
    lastTypedPrefixLengthRef.current = prefixLength;
    lastAutofillAtRef.current = Date.now();
    lastAutofillValueRef.current = match;
    pendingSelectionRef.current = { start: prefixLength, end: match.length };
    onChange(match);
  }, [autoDisabled, minChars, normalizedOptions, onChange, value]);

  useLayoutEffect(() => {
    if (!pendingSelectionRef.current) return;
    if (!inputRef.current) return;
    if (value !== lastAutofillValueRef.current) return;
    const { start, end } = pendingSelectionRef.current;
    inputRef.current.setSelectionRange(start, end);
    pendingSelectionRef.current = null;
  }, [value]);

  const shouldDisableAutofill = () => {
    if (!lastAutofillAtRef.current || !lastAutofillValueRef.current) return false;
    if (Date.now() - lastAutofillAtRef.current > 7000) return false;
    return value === lastAutofillValueRef.current;
  };

  return (
    <div className="space-y-1">
      <Label htmlFor={fieldId}>{label}</Label>
      <div className="relative">
        <Input
          id={fieldId}
          ref={inputRef}
          value={value}
          onChange={event => {
            if (shouldDisableAutofill()) {
              setAutoDisabled(true);
            }
            onChange(event.target.value);
            if (suffixSelectionRef.current) {
              const nextValue = event.target.value;
              requestAnimationFrame(() => {
                inputRef.current?.setSelectionRange(nextValue.length, nextValue.length);
              });
              suffixSelectionRef.current = false;
            }
          }}
          onKeyDown={event => {
            if (event.key === 'Backspace') {
              backspaceJustPressedRef.current = true;
            }
            if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
              if (shouldDisableAutofill()) {
                setAutoDisabled(true);
                const input = inputRef.current;
                const prefixLength = lastTypedPrefixLengthRef.current ?? 0;
                if (input && input.selectionStart === prefixLength && input.selectionEnd === value.length) {
                  suffixSelectionRef.current = true;
                }
              }
            }
          }}
          onBlur={() => setAutoDisabled(false)}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}

function HiddenSettingsPanel({
  open,
  onOpenChange,
  teachers,
  rooms,
  onSave
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teachers: string[];
  rooms: string[];
  onSave: (nextTeachers: string[], nextRooms: string[]) => void;
}) {
  const [teacherText, setTeacherText] = useState('');
  const [roomText, setRoomText] = useState('');

  useEffect(() => {
    if (!open) return;
    setTeacherText(teachers.join('\n'));
    setRoomText(rooms.join('\n'));
  }, [open, rooms, teachers]);

  const handleSave = () => {
    const nextTeachers = sanitizeHiddenList(teacherText);
    const nextRooms = sanitizeHiddenList(roomText);
    onSave(nextTeachers, nextRooms);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hidden settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="hidden-teachers">Lärare (en per rad)</Label>
            <Textarea
              id="hidden-teachers"
              value={teacherText}
              onChange={event => setTeacherText(event.target.value)}
              rows={6}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="hidden-rooms">Salar (en per rad)</Label>
            <Textarea
              id="hidden-rooms"
              value={roomText}
              onChange={event => setRoomText(event.target.value)}
              rows={6}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="neutral" onClick={handleSave} className="border-2 border-black">
            Spara
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CategoryDebugPanel({
  open,
  onOpenChange,
  categories,
  missingCount,
  totalCount
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: string[];
  missingCount: number;
  totalCount: number;
}) {
  const hasCategories = categories.length > 0;
  const hasActivities = totalCount > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kategorier (debug)</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <p className="font-semibold">Unika kategorier ({categories.length})</p>
            {hasCategories ? (
              <ul className="list-disc pl-5">
                {categories.map(category => (
                  <li key={category}>{category}</li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500">Inga kategorier hittades.</p>
            )}
          </div>
          <div>
            <p className="font-semibold">Aktiviteter utan kategori</p>
            <p>{missingCount} av {totalCount}</p>
          </div>
          {!hasActivities && (
            <p className="text-gray-500">Inga aktiviteter laddade ännu.</p>
          )}
          <p className="text-xs text-gray-500">
            Öppna via Ctrl + Shift + C.
          </p>
        </div>
        <DialogFooter>
          <Button variant="neutral" onClick={() => onOpenChange(false)} className="border-2 border-black">
            Stäng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Sub-Components ---

function DraggableSourceCard({
  course,
  onEdit,
  onDelete,
  hidden,
  isDerived
}: {
  course: PlannerCourse;
  onEdit: (c: PlannerCourse) => void;
  onDelete: (course: PlannerCourse, isDerived: boolean) => void;
  hidden?: boolean;
  isDerived?: boolean;
}) {
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
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={() => onDelete(course, Boolean(isDerived))}
          className="p-1 bg-white/50 hover:bg-rose-200 rounded-full text-rose-700 disabled:opacity-40 disabled:hover:bg-white/50"
          disabled={isDerived}
          title={isDerived ? 'Automatiska byggstenar kan inte raderas här.' : 'Ta bort byggsten'}
        >
          <Trash2 size={10} />
        </button>
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
  isLastOfDay,
  showLayoutDebug
}: {
  entry: ScheduledEntry;
  onEdit: (e: ScheduledEntry) => void;
  onRemove: (id: string) => void;
  onContextMenu: (event: React.MouseEvent<HTMLDivElement>, e: ScheduledEntry) => void;
  hidden?: boolean;
  columnIndex: number;
  columnCount: number;
  isLastOfDay: boolean;
  showLayoutDebug: boolean;
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
  const assignmentUrl = extractUrl(entry.category);

  if (hidden) return null;

  const isShortDuration = entry.duration < 50;
  const isCompactHeight = adjustedHeight < 38;
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
      className={`scheduled-event-card rounded border border-black/20 shadow-sm overflow-hidden p-1 group cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-60 ring-2 ring-black' : ''}`}
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
          {showLayoutDebug && (
            <span className="rounded bg-white/70 px-1 text-[9px] font-mono font-bold text-gray-700">
              {columnIndex}/{columnCount}
            </span>
          )}
          <div className="flex items-start gap-0.5">
            {assignmentUrl && (
              <a
                href={assignmentUrl}
                target="_blank"
                rel="noreferrer"
                onPointerDown={e => e.stopPropagation()}
                onClick={e => e.stopPropagation()}
                className="p-0.5 bg-white/70 hover:bg-white rounded text-gray-700"
                aria-label="Öppna uppgift"
                title="Öppna uppgift"
              >
                <FileText size={10} />
              </a>
            )}
            <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 bg-white/60 rounded">
               <button onPointerDown={e => e.stopPropagation()} onClick={() => onEdit(entry)} className="p-0.5 hover:bg-white rounded"><Edit2 size={8}/></button>
               <button onPointerDown={e => e.stopPropagation()} onClick={() => onRemove(entry.instanceId)} className="p-0.5 hover:bg-rose-200 text-rose-600 rounded"><Trash2 size={8}/></button>
            </div>
          </div>
        </div>
        {!isShortDuration && (
          <p className={`font-bold leading-tight truncate ${isCompactHeight ? 'text-xs' : 'text-sm'}`}>{entry.title}</p>
        )}
        {adjustedHeight > 30 && (
           <p className={`text-gray-700 truncate ${isCompactHeight ? 'text-[10px]' : 'text-xs'}`}>
             {entry.teacher && <span className="font-semibold">{entry.teacher}</span>}
             {entry.teacher && entry.room ? ' ' : ''}
             {entry.room}
           </p>
        )}
        {entry.notes && adjustedHeight > 46 && (
          <p className={`text-gray-600 truncate ${isCompactHeight ? 'text-[10px]' : 'text-xs'}`}>{entry.notes}</p>
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

// --- Main Component ---

export default function NewSchedulePlanner() {
  const [manualCourses, setManualCourses] = useState<PlannerCourse[]>(baseCourses);
  const [courses, setCourses] = useState<PlannerCourse[]>([]);
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isRightSidebarCollapsed, setIsRightSidebarCollapsed] = useState(true);
  const [savedWeekNames, setSavedWeekNames] = useState<string[]>([]);
  const [weekName, setWeekName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showLayoutDebug, setShowLayoutDebug] = useState(false);
  const isSavingRef = useRef(false);
  const [teachers, setTeachers] = useState<string[]>([]);
  const [rooms, setRooms] = useState<string[]>([]);
  const [isHiddenSettingsOpen, setIsHiddenSettingsOpen] = useState(false);
  const [isCategoryDebugOpen, setIsCategoryDebugOpen] = useState(false);
  const titleHoldTimerRef = useRef<number | null>(null);

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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (process.env.NODE_ENV !== 'development') return;
    const params = new URLSearchParams(window.location.search);
    const queryEnabled = params.has('debugLayout') && params.get('debugLayout') !== '0';
    const envEnabled = process.env.NEXT_PUBLIC_SCHEDULE_DEBUG_LAYOUT === 'true';
    setShowLayoutDebug(queryEnabled || envEnabled);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(MANUAL_COURSES_STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      const sanitized = sanitizeManualCourses(parsed);
      if (sanitized.length > 0) {
        setManualCourses(sanitized);
      }
    } catch (error) {
      console.warn('Kunde inte läsa manuella byggstenar.', error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    runLayoutFixtureValidation();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const storedTeachers = window.localStorage.getItem(TEACHERS_STORAGE_KEY);
      const storedRooms = window.localStorage.getItem(ROOMS_STORAGE_KEY);
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

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'c') return;
      if (!event.ctrlKey || !event.shiftKey) return;
      event.preventDefault();
      setIsCategoryDebugOpen(true);
    };
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(MANUAL_COURSES_STORAGE_KEY, JSON.stringify(manualCourses));
    } catch (error) {
      console.warn('Kunde inte spara manuella byggstenar.', error);
    }
  }, [manualCourses]);

  useEffect(() => {
    const loadPlannerActivities = async () => {
      try {
        const activities = await plannerService.getPlannerActivities();
        const mappedSchedule = sanitizeScheduleImport(
          activities.map(activity => ({
            id: activity.id,
            title: activity.title,
            teacher: activity.teacher ?? '',
            room: activity.room ?? '',
            color: activity.color ?? generateBoxColor(activity.title ?? ''),
            duration: activity.duration ?? 60,
            category: activity.category,
            instanceId: activity.id,
            day: activity.day ?? days[0],
            startTime: activity.startTime ?? '08:00',
            endTime: activity.endTime ?? minutesToTime(timeToMinutes(activity.startTime ?? '08:00') + 60),
            notes: activity.notes ?? undefined
          }))
        );
        setSchedule(mappedSchedule);
        scheduleHistoryRef.current = [];
        scheduleFutureRef.current = [];
      } catch (e) {
        console.error('Planner load failed', e);
      }
    };

    loadPlannerActivities();
  }, []);

  useEffect(() => {
    const loadArchiveNames = async () => {
      try {
        const names = await plannerService.getPlannerArchiveNames();
        setSavedWeekNames(names);
      } catch (error) {
        console.error('Archive names load failed', error);
      }
    };

    loadArchiveNames();
  }, []);

  const handleHiddenSettingsSave = useCallback((nextTeachers: string[], nextRooms: string[]) => {
    setTeachers(nextTeachers);
    setRooms(nextRooms);
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(TEACHERS_STORAGE_KEY, JSON.stringify(nextTeachers));
      window.localStorage.setItem(ROOMS_STORAGE_KEY, JSON.stringify(nextRooms));
    } catch (error) {
      console.warn('Kunde inte spara lärare/salar.', error);
    }
  }, []);

  const startTitleHold = () => {
    if (titleHoldTimerRef.current) {
      window.clearTimeout(titleHoldTimerRef.current);
    }
    titleHoldTimerRef.current = window.setTimeout(() => {
      setIsHiddenSettingsOpen(true);
      titleHoldTimerRef.current = null;
    }, 700);
  };

  const clearTitleHold = () => {
    if (!titleHoldTimerRef.current) return;
    window.clearTimeout(titleHoldTimerRef.current);
    titleHoldTimerRef.current = null;
  };

  const recomputeCourses = useCallback((nextSchedule: ScheduledEntry[], nextManual: PlannerCourse[]) => {
    const derived = deriveCoursesFromSchedule(nextSchedule);
    const merged = mergeCourses(nextManual, derived);
    setCourses(merged);
  }, []);

  const manualCourseKeys = useMemo(() => (
    new Set(manualCourses.map(course => buildCourseDedupeKey(course)))
  ), [manualCourses]);

  const derivedCourseKeys = useMemo(() => (
    new Set(deriveCoursesFromSchedule(schedule).map(course => buildCourseDedupeKey(course)))
  ), [schedule]);

  const categoryStats = useMemo(() => {
    const normalized = schedule.map(entry => (
      typeof entry.category === 'string' ? entry.category.trim() : ''
    ));
    const unique = Array.from(new Set(normalized.filter(Boolean))).sort((a, b) => a.localeCompare(b, 'sv'));
    const missingCount = normalized.filter(value => !value).length;
    return {
      unique,
      missingCount,
      totalCount: schedule.length
    };
  }, [schedule]);

  useEffect(() => {
    recomputeCourses(schedule, manualCourses);
  }, [manualCourses, recomputeCourses, schedule]);

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

  const sortedWeekNames = useMemo(() => {
    const weekPattern = /^v\.?\s*(\d+)$/i;
    const getWeekNumber = (name: string) => {
      const match = name.match(weekPattern);
      return match ? Number(match[1]) : null;
    };

    return [...savedWeekNames].sort((a, b) => {
      const weekA = getWeekNumber(a);
      const weekB = getWeekNumber(b);

      if (weekA !== null && weekB !== null) {
        return weekA - weekB;
      }

      return a.localeCompare(b, 'sv');
    });
  }, [savedWeekNames]);

  const hoursFormatter = useMemo(() => new Intl.NumberFormat('sv-SE', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }), []);

  const layoutByDay = useMemo(() => {
    const layout: Record<string, Map<string, DayLayoutEntry>> = {};
    days.forEach(day => {
      const entries = schedule.filter(entry => entry.day === day);
      layout[day] = buildDayLayout(entries);
    });
    return layout;
  }, [schedule]);

  const daySubjectTotals = useMemo(() => {
    const totals: Record<string, Record<string, number>> = {};
    const intervalsByDay: Record<string, Record<string, { start: number; end: number }[]>> = {};
    days.forEach(day => {
      totals[day] = {};
      intervalsByDay[day] = {};
    });
    schedule.forEach(entry => {
      if (!intervalsByDay[entry.day]) {
        intervalsByDay[entry.day] = {};
      }
      if (!intervalsByDay[entry.day][entry.title]) {
        intervalsByDay[entry.day][entry.title] = [];
      }
      intervalsByDay[entry.day][entry.title].push({
        start: timeToMinutes(entry.startTime),
        end: timeToMinutes(entry.endTime),
      });
    });
    Object.entries(intervalsByDay).forEach(([day, subjects]) => {
      Object.entries(subjects).forEach(([title, intervals]) => {
        if (intervals.length === 0) return;
        const sorted = [...intervals].sort((a, b) => a.start - b.start);
        let total = 0;
        let currentStart = sorted[0].start;
        let currentEnd = sorted[0].end;
        sorted.slice(1).forEach(interval => {
          if (interval.start < currentEnd && interval.end > currentStart) {
            currentEnd = Math.max(currentEnd, interval.end);
          } else {
            total += currentEnd - currentStart;
            currentStart = interval.start;
            currentEnd = interval.end;
          }
        });
        total += currentEnd - currentStart;
        totals[day][title] = total;
      });
    });
    return totals;
  }, [schedule]);

  const formatDuration = useCallback((minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;
    return `${hours}h + ${remaining} min`;
  }, []);

  const mapScheduleToPlannerActivities = useCallback((entries: ScheduledEntry[]): PlannerActivity[] => (
    entries.map(entry => ({
      id: entry.instanceId,
      title: entry.title,
      room: entry.room,
      teacher: entry.teacher,
      notes: entry.notes ?? '',
      day: entry.day,
      startTime: entry.startTime,
      endTime: entry.endTime,
      duration: entry.duration,
      color: entry.color,
      category: entry.category
    }))
  ), []);

  const dayHeaderTooltips = useMemo(() => {
    const tooltips: Record<string, string> = {};
    days.forEach(day => {
      const entries = Object.entries(daySubjectTotals[day] ?? {});
      if (entries.length === 0) {
        tooltips[day] = 'Inget schemalagt';
        return;
      }
      const totalMinutes = entries.reduce((sum, [, minutes]) => sum + minutes, 0);
      const lines = entries
        .sort((a, b) => b[1] - a[1])
        .map(([title, minutes]) => `${title}: ${formatDuration(minutes)}`);
      tooltips[day] = [`Totalt: ${formatDuration(totalMinutes)}`, ...lines].join('\n');
    });
    return tooltips;
  }, [daySubjectTotals, formatDuration]);

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
            setManualCourses(sanitizeManualCourses(parsed.courses));
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

  const handleSyncToCloud = useCallback(async () => {
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setIsSaving(true);
    try {
      const payload = mapScheduleToPlannerActivities(schedule);
      const { activities } = await plannerService.syncActivities(payload);
      if (process.env.NODE_ENV !== 'production') {
        console.info('Planner sync returned activities', activities);
      }
      const mappedSchedule = sanitizeScheduleImport(
        activities.map(activity => ({
          id: activity.id,
          title: activity.title,
          teacher: activity.teacher ?? '',
          room: activity.room ?? '',
          color: activity.color ?? generateBoxColor(activity.title ?? ''),
          duration: activity.duration ?? 60,
          category: activity.category,
          instanceId: activity.id,
          day: activity.day ?? days[0],
          startTime: activity.startTime ?? '08:00',
          endTime: activity.endTime ?? minutesToTime(timeToMinutes(activity.startTime ?? '08:00') + 60),
          notes: activity.notes ?? undefined
        }))
      );
      // Replace local IDs after sync because the server generates new UUIDs.
      setSchedule(mappedSchedule);
      scheduleHistoryRef.current = [];
      scheduleFutureRef.current = [];
      alert('Schema synkat till molnet.');
    } catch (error) {
      console.error('Cloud sync failed', error);
      alert('Kunde inte synka schemat.');
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }, [mapScheduleToPlannerActivities, schedule]);

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

  const handleSaveWeek = useCallback(async () => {
    const trimmedName = weekName.trim();
    if (!trimmedName) {
      alert('Ange ett veckonamn.');
      return;
    }
    if (savedWeekNames.includes(trimmedName)) {
      const shouldOverwrite = confirm(`Vecka "${trimmedName}" finns redan. Skriva över?`);
      if (!shouldOverwrite) return;
    }
    try {
      const payload = mapScheduleToPlannerActivities(schedule);
      await plannerService.savePlannerArchive(trimmedName, payload);
      setSavedWeekNames(prev => (
        prev.includes(trimmedName) ? prev : [...prev, trimmedName]
      ));
      setWeekName('');
      alert('Veckan sparades i arkivet.');
    } catch (error) {
      console.error('Archive save failed', error);
      alert('Kunde inte spara veckan.');
    }
  }, [weekName, savedWeekNames, schedule, mapScheduleToPlannerActivities]);

  const handleLoadWeek = useCallback(async (name: string) => {
    const shouldLoad = confirm(`Ersätta nuvarande schema med "${name}"?`);
    if (!shouldLoad) return;
    try {
      const entries = await plannerService.getPlannerArchive(name);
      const mappedSchedule = sanitizeScheduleImport(
        entries.map(activity => ({
          id: activity.id,
          title: activity.title,
          teacher: activity.teacher ?? '',
          room: activity.room ?? '',
          color: activity.color ?? generateBoxColor(activity.title ?? ''),
          duration: activity.duration ?? 60,
          category: activity.category,
          instanceId: activity.id,
          day: activity.day ?? days[0],
          startTime: activity.startTime ?? '08:00',
          endTime: activity.endTime ?? minutesToTime(timeToMinutes(activity.startTime ?? '08:00') + 60),
          notes: activity.notes ?? undefined
        }))
      );
      commitSchedule(() => mappedSchedule);
    } catch (error) {
      console.error('Archive load failed', error);
      alert('Kunde inte läsa in veckan.');
    }
  }, [commitSchedule]);

  const handleDeleteWeek = useCallback(async (name: string) => {
    const shouldDelete = confirm(`Radera vecka "${name}"?`);
    if (!shouldDelete) return;
    try {
      await plannerService.deletePlannerArchive(name);
      setSavedWeekNames(prev => prev.filter(existing => existing !== name));
    } catch (error) {
      console.error('Archive delete failed', error);
      alert('Kunde inte ta bort veckan.');
    }
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

  const handleDeleteCourse = (course: PlannerCourse, isDerived: boolean) => {
     if (isDerived) {
       alert('Automatiska byggstenar kan inte raderas. Redigera för att skapa en manuell kopia.');
       return;
     }
     if(confirm("Ta bort?")) setManualCourses(p => p.filter(c => c.id !== course.id));
  };
  const handleSaveCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if(!editingCourse) return;
    setManualCourses(p => {
      const courseKey = buildCourseDedupeKey(editingCourse);
      const isDerived = derivedCourseKeys.has(courseKey) && !manualCourseKeys.has(courseKey);
      const manualId = isDerived ? uuidv4() : editingCourse.id;
      const nextCourse = { ...editingCourse, id: manualId };
      const exists = p.find(c => c.id === manualId);
      return exists ? p.map(c => c.id === manualId ? nextCourse : c) : [...p, nextCourse];
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

  const captureScheduleCanvas = async () => {
    const el = document.getElementById('schedule-canvas');
    if (!el) return null;
    el.classList.add('pdf-export');
    try {
      const maxCanvasSize = 16000;
      const targetWidth = el.scrollWidth;
      const targetHeight = el.scrollHeight;
      const scaleToLimit = Math.min(
        2,
        maxCanvasSize / Math.max(targetWidth, 1),
        maxCanvasSize / Math.max(targetHeight, 1)
      );
      return await html2canvas(el, {
        // Clamp scale to avoid exceeding browser canvas limits on large schedules.
        scale: scaleToLimit,
        width: targetWidth,
        height: targetHeight,
        windowWidth: targetWidth,
        windowHeight: targetHeight
      });
    } finally {
      el.classList.remove('pdf-export');
    }
  };

  const handleExportPDF = async () => {
    const exportElement = document.getElementById('schedule-canvas');
    if (isVectorPdfExportEnabled && exportElement) {
      await exportElementToVectorPdf(exportElement, {
        filename: 'schema.pdf',
        extraClassNames: ['pdf-export']
      });
      return;
    }
    const canvas = await captureScheduleCanvas();
    if (!canvas) return;
    const pdf = new jsPDF('l', 'pt', 'a4');
    const imageData = canvas.toDataURL('image/png');
    const imgProps = pdf.getImageProperties(imageData);
    const margin = 20;
    const pdfWidth = pdf.internal.pageSize.getWidth() - margin * 2;
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    // Fit to the printable width so content cannot clip horizontally in the PDF.
    pdf.addImage(imageData, 'PNG', margin, margin, pdfWidth, pdfHeight);
    pdf.save('schema.pdf');
  };

  const handleExportImage = async (type: 'png' | 'jpeg') => {
    const canvas = await captureScheduleCanvas();
    if (!canvas) return;
    const dataUrl = type === 'png'
      ? canvas.toDataURL('image/png')
      : canvas.toDataURL('image/jpeg', 0.92);
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = type === 'png' ? 'schema.png' : 'schema.jpg';
    link.click();
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
              <h1
                className="font-monument text-xl select-none"
                onPointerDown={startTitleHold}
                onPointerUp={clearTitleHold}
                onPointerLeave={clearTitleHold}
                onPointerCancel={clearTitleHold}
              >
                FlexSchema <span className="text-xs font-sans font-normal text-gray-500">v5 Timeline</span>
              </h1>
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
              <Button variant="neutral" onClick={() => handleExportImage('png')} className="border-2 border-black">PNG</Button>
              <Button variant="neutral" onClick={() => handleExportImage('jpeg')} className="border-2 border-black">JPG</Button>
              <input type="file" accept=".json" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImportJSON} />
              <Button variant="neutral" onClick={handleExportJSON} className="border-2 border-black bg-blue-100 hover:bg-blue-200"><Download size={16} className="mr-2"/> Spara</Button>
              <Button variant="neutral" onClick={() => fileInputRef.current?.click()} className="border-2 border-black bg-blue-100 hover:bg-blue-200"><Upload size={16} className="mr-2"/> Ladda</Button>
              <Button variant="neutral" onClick={handleSyncToCloud} disabled={isSaving} className="border-2 border-black bg-sky-100 hover:bg-sky-200"><CloudUpload size={16} className="mr-2"/> Spara till molnet</Button>
              <Button
                variant="neutral"
                onClick={() => {
                  recomputeCourses(schedule, manualCourses);
                  alert('Byggstenar uppdaterade.');
                }}
                className="border-2 border-black bg-emerald-100 hover:bg-emerald-200"
              >
                <RefreshCcw size={16} className="mr-2"/> Uppdatera byggstenar från schema
              </Button>
              <Button variant="neutral" onClick={() => {if(confirm('Rensa?')) commitSchedule(() => [])}} className="border-2 border-black bg-rose-100 text-rose-800"><RefreshCcw size={16} className="mr-2"/> Rensa</Button>
           </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 h-[1100px]">
          
          {/* Sidebar */}
          <div
            className={`flex flex-col gap-4 h-full transition-all duration-300 ${
              isSidebarCollapsed ? 'lg:w-[72px]' : 'lg:w-[320px]'
            }`}
          >
             <div className={`rounded-xl border-2 border-black bg-white shadow-[4px_4px_0px_rgba(0,0,0,1)] flex-1 overflow-hidden flex flex-col transition-all duration-300 ${
               isSidebarCollapsed ? 'p-2' : 'p-4'
             }`}>
                <div className="flex justify-between items-center mb-4">
                  <h2 className={`font-bold flex items-center gap-2 ${isSidebarCollapsed ? 'sr-only' : ''}`}>
                    <Settings size={18}/> Byggstenar
                  </h2>
                  <div className="flex items-center gap-2">
                    {!isSidebarCollapsed && (
                      <Button size="sm" onClick={() => { 
                        setManualColor(false);
                        setEditingCourse({ id: uuidv4(), title: '', teacher: '', room: '', color: '#ffffff', duration: 60 }); 
                        setIsCourseModalOpen(true); 
                      }} className="h-8 w-8 p-0 rounded-full border-2 border-black bg-[#aee8fe]"><Plus size={16}/></Button>
                    )}
                    <Button
                      size="sm"
                      variant="neutral"
                      onClick={() => setIsSidebarCollapsed(prev => !prev)}
                      className="h-8 w-8 p-0 border-2 border-black"
                      aria-label={isSidebarCollapsed ? 'Visa byggstenar' : 'Dölj byggstenar'}
                    >
                      {isSidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                    </Button>
                  </div>
                </div>
                
                {/* Courses List */}
                {!isSidebarCollapsed && (
                  <div className="overflow-y-auto flex-1 pr-2">
                     {courses.map(c => (
                       <DraggableSourceCard 
                         key={c.id}
                         course={c}
                         onEdit={(c) => { setManualColor(true); setEditingCourse(c); setIsCourseModalOpen(true); }}
                         onDelete={handleDeleteCourse}
                         isDerived={derivedCourseKeys.has(buildCourseDedupeKey(c)) && !manualCourseKeys.has(buildCourseDedupeKey(c))}
                         hidden={!advancedFilterMatch(c, filterQuery)}
                       />
                     ))}
                  </div>
                )}

                {/* Statistics */}
                {!isSidebarCollapsed && (
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
                )}

             </div>
          </div>

          {/* Main Schedule Area */}
          <div className="flex-1 rounded-xl border-2 border-black bg-gray-50 overflow-hidden shadow-[4px_4px_0px_rgba(0,0,0,1)] flex flex-col h-full">
             <div className="flex pl-[50px] border-b-2 border-black bg-white">
                {days.map(day => (
                  <div
                    key={day}
                    className="flex-1 py-2 text-center font-bold text-sm border-r border-gray-200 last:border-0 cursor-help"
                    title={dayHeaderTooltips[day]}
                  >
                    {day}
                  </div>
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
                          const columnIndex = layout?.colIndex ?? 0;
                          const columnCount = layout?.colCount ?? 1;
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
                              showLayoutDebug={showLayoutDebug}
                           />
                          );
                          });
                        })()}
                     </DayColumn>
                   ))}
                </div>
             </div>
          </div>

          {/* Archive Sidebar */}
          <div
            className={`flex flex-col gap-4 h-full transition-all duration-300 ${
              isRightSidebarCollapsed ? 'lg:w-[72px]' : 'lg:w-[320px]'
            }`}
          >
             <div className={`rounded-xl border-2 border-black bg-white shadow-[4px_4px_0px_rgba(0,0,0,1)] flex-1 overflow-hidden flex flex-col transition-all duration-300 ${
               isRightSidebarCollapsed ? 'p-2' : 'p-4'
             }`}>
                <div className={`flex ${isRightSidebarCollapsed ? 'flex-col items-center gap-3' : 'justify-between items-center mb-4'}`}>
                  <h2 className={`font-bold flex items-center gap-2 ${isRightSidebarCollapsed ? 'sr-only' : ''}`}>
                    <Archive size={18}/> Sparade Veckor
                  </h2>
                  <Button
                    size="sm"
                    variant="neutral"
                    onClick={() => setIsRightSidebarCollapsed(prev => !prev)}
                    className="h-8 w-8 p-0 border-2 border-black"
                    aria-label={isRightSidebarCollapsed ? 'Visa arkiv' : 'Dölj arkiv'}
                  >
                    {isRightSidebarCollapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                  </Button>
                  {isRightSidebarCollapsed && (
                    <div className="flex flex-col items-center gap-2 text-xs font-bold text-gray-600">
                      <Archive size={18}/>
                    </div>
                  )}
                </div>

                {!isRightSidebarCollapsed && (
                  <div className="flex flex-col gap-4 flex-1">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-gray-500">Spara vecka</Label>
                      <div className="flex gap-2">
                        <Input
                          value={weekName}
                          onChange={(e) => setWeekName(e.target.value)}
                          placeholder="Vecka 42 eller Höstlov"
                          className="border-2 border-black shadow-sm"
                        />
                        <Button
                          variant="neutral"
                          onClick={handleSaveWeek}
                          disabled={!weekName.trim()}
                          className="border-2 border-black bg-amber-100 hover:bg-amber-200"
                        >
                          <Save size={14} className="mr-2"/> Spara
                        </Button>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-1 space-y-2">
                      {sortedWeekNames.length === 0 ? (
                        <p className="text-sm text-gray-500 italic">Inga sparade veckor ännu.</p>
                      ) : (
                        sortedWeekNames.map(name => (
                          <div
                            key={name}
                            className="rounded-xl border-2 border-black bg-white shadow-[2px_2px_0px_rgba(0,0,0,1)] p-3 flex items-center justify-between gap-2"
                          >
                            <span className="font-bold text-sm truncate">{name}</span>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="neutral"
                                onClick={() => handleLoadWeek(name)}
                                className="h-8 border-2 border-black bg-emerald-100 hover:bg-emerald-200"
                              >
                                <FolderOpen size={14} className="mr-1"/> Ladda
                              </Button>
                              <Button
                                size="sm"
                                variant="neutral"
                                onClick={() => handleDeleteWeek(name)}
                                className="h-8 w-8 p-0 border-2 border-black bg-rose-100 hover:bg-rose-200 text-rose-800"
                              >
                                <Trash2 size={14}/>
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
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
      <HiddenSettingsPanel
        open={isHiddenSettingsOpen}
        onOpenChange={setIsHiddenSettingsOpen}
        teachers={teachers}
        rooms={rooms}
        onSave={handleHiddenSettingsSave}
      />
      <CategoryDebugPanel
        open={isCategoryDebugOpen}
        onOpenChange={setIsCategoryDebugOpen}
        categories={categoryStats.unique}
        missingCount={categoryStats.missingCount}
        totalCount={categoryStats.totalCount}
      />
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
                 <SmartTextInput
                   fieldId="course-teacher"
                   label="Lärare"
                   value={editingCourse.teacher}
                   options={teachers}
                   onChange={teacher => setEditingCourse({ ...editingCourse, teacher })}
                 />
                 <SmartTextInput
                   fieldId="course-room"
                   label="Rum"
                   value={editingCourse.room}
                   options={rooms}
                   onChange={room => setEditingCourse({ ...editingCourse, room })}
                 />
               </div>
               <div className="flex flex-wrap items-center gap-2 mt-2">
                 <div className="flex gap-2">
                   {palette.map(c => (
                     <div
                       key={c}
                       onClick={() => {
                         setManualColor(true);
                         setEditingCourse({ ...editingCourse, color: c });
                       }}
                       className={`w-6 h-6 rounded-full cursor-pointer border ${
                         editingCourse.color === c ? 'ring-2 ring-black' : ''
                       }`}
                       style={{ backgroundColor: c }}
                     />
                   ))}
                 </div>
                 <label className="inline-flex items-center gap-2 text-xs text-gray-700 border border-black/20 rounded px-2 py-1 bg-white/70 hover:bg-white cursor-pointer">
                   <span
                     className="h-4 w-4 rounded-full border border-black"
                     style={{ backgroundColor: editingCourse.color }}
                   />
                   Egen färg
                   <input
                     type="color"
                     className="sr-only"
                     aria-label="Välj egen färg"
                     value={editingCourse.color}
                     onChange={e => {
                       setManualColor(true);
                       setEditingCourse({ ...editingCourse, color: e.target.value });
                     }}
                   />
                 </label>
               </div>
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
                <div className="grid grid-cols-2 gap-2">
                  <SmartTextInput
                    fieldId="entry-teacher"
                    label="Lärare"
                    value={editingEntry.teacher}
                    options={teachers}
                    onChange={teacher => setEditingEntry({ ...editingEntry, teacher })}
                  />
                  <SmartTextInput
                    fieldId="entry-room"
                    label="Rum"
                    value={editingEntry.room}
                    options={rooms}
                    onChange={room => setEditingEntry({ ...editingEntry, room })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="entry-category">Uppgift:</Label>
                  <Textarea
                    id="entry-category"
                    placeholder="Klistra in uppgiftslänk eller skriv en kort markering"
                    value={editingEntry.category ?? ''}
                    onChange={e => setEditingEntry({ ...editingEntry, category: e.target.value })}
                    rows={2}
                  />
                </div>
                <Input
                  aria-label="Anteckningar"
                  placeholder="Anteckningar/övrigt"
                  value={editingEntry.notes ?? ''}
                  onChange={e => setEditingEntry({ ...editingEntry, notes: e.target.value })}
                />
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <div className="flex gap-2">
                    {palette.map(c => (
                      <div
                        key={c}
                        onClick={() => setEditingEntry({ ...editingEntry, color: c })}
                        className={`w-6 h-6 rounded-full cursor-pointer border ${
                          editingEntry.color === c ? 'ring-2 ring-black' : ''
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs text-gray-700 border border-black/20 rounded px-2 py-1 bg-white/70 hover:bg-white cursor-pointer">
                    <span
                      className="h-4 w-4 rounded-full border border-black"
                      style={{ backgroundColor: editingEntry.color || '#ffffff' }}
                    />
                    Egen färg
                    <input
                      type="color"
                      className="sr-only"
                      aria-label="Välj egen färg"
                      value={editingEntry.color || '#ffffff'}
                      onChange={e => setEditingEntry({ ...editingEntry, color: e.target.value })}
                    />
                  </label>
                </div>
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
