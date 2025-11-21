'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDroppable,
  useDraggable,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
  DragStartEvent,
} from '@dnd-kit/core';
import { restrictToWindowEdges } from '@dnd-kit/modifiers';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
  Download,
  RefreshCcw,
  Trash2,
  Plus,
  Clock,
  Edit2,
  Settings,
  ShieldAlert,
  BarChart3,
  X
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { generateBoxColor, importColors } from '@/config/colorManagement';

const STORAGE_KEY = 'drive-c-schedule-planner-v4';

const days = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag'];

const palette = [
  '#ffffff', '#fde68a', '#bae6fd', '#d9f99d', '#fecdd3', 
  '#c7d2fe', '#a7f3d0', '#ddd6fe', '#fed7aa'
];

// --- Types ---

interface TimeSlot {
  id: string;
  label: string;
}

interface PlannerCourse {
  id: string;
  title: string;
  teacher: string;
  room: string;
  color: string;
  duration: number;
  category?: string;
}

interface ScheduledEntry extends PlannerCourse {
  instanceId: string;
  day: string;
  slotId: string;
}

interface RestrictionRule {
  id: string;
  subjectA: string; 
  subjectB: string; 
}

interface PersistedPlannerState {
  courses: PlannerCourse[];
  schedule: ScheduledEntry[];
  timeSlots: TimeSlot[];
  restrictions: RestrictionRule[];
}

const baseCourses: PlannerCourse[] = [
  { id: 'c1', title: 'Matematik 1a', teacher: 'L. Holm', duration: 60, color: '#fde68a', category: 'Natur', room: 'A1' },
  { id: 'c2', title: 'Svenska 1', teacher: 'E. Ström', duration: 60, color: '#bae6fd', category: 'Språk', room: 'B2' },
  { id: 'c3', title: 'Engelska 5', teacher: 'M. Khan', duration: 60, color: '#d9f99d', category: 'Språk', room: 'C3' },
];

// --- Helper Logic: Advanced Filtering & Restrictions ---

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

const wildcardMatch = (pattern: string, text: string): boolean => {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&'); 
  const regexString = '^' + escaped.replace(/\*/g, '.*') + '$';
  const regex = new RegExp(regexString, 'i');
  return regex.test(text);
};

const validateRestrictions = (
  entryTitle: string,
  targetDay: string,
  targetSlotId: string,
  currentSchedule: ScheduledEntry[],
  rules: RestrictionRule[],
  ignoreInstanceId?: string 
): string | null => {
  
  const existingInSlot = currentSchedule.filter(
    e => e.day === targetDay && e.slotId === targetSlotId && e.instanceId !== ignoreInstanceId
  );

  if (existingInSlot.length === 0) return null; 

  for (const existing of existingInSlot) {
    for (const rule of rules) {
      const matchA_New = wildcardMatch(rule.subjectA, entryTitle);
      const matchB_Exist = wildcardMatch(rule.subjectB, existing.title);
      
      const matchB_New = wildcardMatch(rule.subjectB, entryTitle);
      const matchA_Exist = wildcardMatch(rule.subjectA, existing.title);

      if ((matchA_New && matchB_Exist) || (matchB_New && matchA_Exist)) {
        return `Konflikt! "${rule.subjectA}" får inte krocka med "${rule.subjectB}". (${existing.title} ligger redan här)`;
      }
    }
  }

  return null;
};


// --- Components ---

function CourseCard({ course, onEdit, onDelete, isOverlay, hidden }: { 
  course: PlannerCourse; 
  onEdit?: (c: PlannerCourse) => void; 
  onDelete?: (id: string) => void;
  isOverlay?: boolean;
  hidden?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: course.id,
    data: { type: 'course', course },
    disabled: isOverlay 
  });

  if (hidden) return null;

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    backgroundColor: course.color
  } : {
    backgroundColor: course.color
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`planner-card relative group mb-2 ${
        isDragging ? 'opacity-50' : 'opacity-100'
      } ${isOverlay ? 'cursor-grabbing shadow-xl scale-105 rotate-1' : 'cursor-grab'}`}
    >
      <div className="flex items-start justify-between pr-6">
        <div className="space-y-0.5">
          <p className="text-sm font-bold text-gray-900">{course.title || 'Nytt ämne'}</p>
          {(course.teacher || course.room) && (
            <p className="text-[10px] text-gray-700">
              {course.teacher} {course.room ? `(${course.room})` : ''}
            </p>
          )}
        </div>
      </div>
      
      {!isOverlay && onEdit && onDelete && (
        <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onEdit(course)}
            className="p-1 bg-white/50 hover:bg-white rounded-full"
          >
            <Edit2 size={12} />
          </button>
          <button
             type="button"
             onPointerDown={(e) => e.stopPropagation()}
             onClick={() => onDelete(course.id)}
             className="p-1 bg-white/50 hover:bg-rose-200 rounded-full text-rose-700"
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

function ScheduledCard({
  entry,
  onRemove,
  onEdit,
  hidden
}: {
  entry: ScheduledEntry;
  onRemove: (id: string) => void;
  onEdit: (entry: ScheduledEntry) => void;
  hidden?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: entry.instanceId,
    data: { type: 'scheduled', entry },
  });

  if (hidden) return null;

  const style = transform
    ? { 
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        backgroundColor: entry.color 
      }
    : { backgroundColor: entry.color };

  return (
    <article
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`planner-card relative group min-h-[60px] flex-1 min-w-0 w-full ${isDragging ? 'opacity-30' : ''}`}
    >
      <div className="space-y-0.5 overflow-hidden">
        <h4 className="text-xs font-bold text-gray-900 leading-tight truncate">{entry.title}</h4>
        <p className="text-[10px] text-gray-700 truncate">
           {entry.teacher} {entry.room ? `• ${entry.room}` : ''}
        </p>
      </div>
      
      <div className="absolute top-1 right-1 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/50 rounded p-0.5 backdrop-blur-sm z-10">
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onEdit(entry)}
          className="p-1 bg-white/80 hover:bg-white rounded border border-black/10"
        >
          <Edit2 size={10} />
        </button>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onRemove(entry.instanceId)}
          className="p-1 bg-white/80 hover:bg-rose-100 rounded border border-black/10 text-rose-600"
        >
          <Trash2 size={10} />
        </button>
      </div>
    </article>
  );
}

function ScheduleCell({ day, slotId, children }: { day: string; slotId: string; children: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({
    id: `${day}::${slotId}`,
    data: { day, slotId },
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[80px] flex-row items-stretch gap-1 rounded-lg border border-gray-300 bg-white p-1 transition-colors ${
        isOver ? 'bg-blue-50 ring-2 ring-inset ring-blue-400' : ''
      }`}
    >
      {children}
    </div>
  );
}

// --- Main Component ---

export default function NewSchedulePlanner() {
  // --- State ---
  const [courses, setCourses] = useState<PlannerCourse[]>([]);
  const [schedule, setSchedule] = useState<ScheduledEntry[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([
    { id: 'slot-1', label: '08:15 - 09:00' },
    { id: 'slot-2', label: '09:15 - 10:00' },
    { id: 'slot-3', label: '10:15 - 11:00' },
    { id: 'slot-4', label: '12:00 - 13:00' },
  ]);
  const [restrictions, setRestrictions] = useState<RestrictionRule[]>([]);

  // Filter State
  const [filterQuery, setFilterQuery] = useState("");

  const [activeDragItem, setActiveDragItem] = useState<PlannerCourse | ScheduledEntry | null>(null);

  // Modals
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<PlannerCourse | null>(null);
  const [manualColor, setManualColor] = useState(false);
  
  const [isTimeModalOpen, setIsTimeModalOpen] = useState(false);
  
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ScheduledEntry | null>(null);

  const [isRestrictionsModalOpen, setIsRestrictionsModalOpen] = useState(false);
  const [newRule, setNewRule] = useState<RestrictionRule>({ id: '', subjectA: '', subjectB: '' });

  // --- Sensors ---
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor)
  );

  // --- Load/Save ---
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as PersistedPlannerState;
        setCourses(parsed.courses || baseCourses);
        setSchedule(parsed.schedule || []);
        setTimeSlots(parsed.timeSlots || []);
        setRestrictions(parsed.restrictions || []);
      } catch (e) {
        console.error("Failed to load schedule", e);
      }
    } else {
      setCourses(baseCourses);
    }
  }, []);

  useEffect(() => {
    const payload: PersistedPlannerState = { courses, schedule, timeSlots, restrictions };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [courses, schedule, timeSlots, restrictions]);

  useEffect(() => {
    const colorMap = courses.map(c => ({ className: c.title, color: c.color }));
    importColors(colorMap);
  }, [courses]);

  // --- Computed Data for Statistics ---
  const scheduleStats = useMemo(() => {
    const stats: Record<string, number> = {};
    
    const visibleSchedule = schedule.filter(entry => advancedFilterMatch(entry, filterQuery));

    visibleSchedule.forEach(entry => {
      if (!stats[entry.title]) stats[entry.title] = 0;
      stats[entry.title] += entry.duration;
    });
    
    return Object.entries(stats).sort((a, b) => b[1] - a[1]);
  }, [schedule, filterQuery]);


  // --- Handlers: Drag & Drop ---

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const type = active.data.current?.type;
    
    if (type === 'course') {
      setActiveDragItem(active.data.current?.course);
    } else if (type === 'scheduled') {
      setActiveDragItem(active.data.current?.entry);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragItem(null);

    if (!over) return;

    const [dropDay, dropSlotId] = (over.id as string).split('::');
    if (!dropDay || !dropSlotId) return;

    const type = active.data.current?.type;

    // Validering mot restriktioner
    let titleToCheck = "";
    let ignoreId = undefined;

    if (type === 'course') {
      const course = active.data.current?.course as PlannerCourse;
      titleToCheck = course.title;
    } else if (type === 'scheduled') {
      const entry = active.data.current?.entry as ScheduledEntry;
      titleToCheck = entry.title;
      ignoreId = entry.instanceId;
    }

    const conflictError = validateRestrictions(titleToCheck, dropDay, dropSlotId, schedule, restrictions, ignoreId);
    
    if (conflictError) {
      alert(conflictError); 
      return; 
    }

    if (type === 'course') {
      const course = active.data.current?.course as PlannerCourse;
      const newEntry: ScheduledEntry = {
        ...course,
        instanceId: uuidv4(),
        day: dropDay,
        slotId: dropSlotId,
      };
      setSchedule(prev => [...prev, newEntry]);
    } 
    else if (type === 'scheduled') {
      const entry = active.data.current?.entry as ScheduledEntry;
      setSchedule(prev => prev.map(e => 
        e.instanceId === entry.instanceId 
          ? { ...e, day: dropDay, slotId: dropSlotId }
          : e
      ));
    }
  };

  // --- Course Handlers ---
  const handleSaveCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourse) return;
    if (courses.find(c => c.id === editingCourse.id)) {
      setCourses(prev => prev.map(c => c.id === editingCourse.id ? editingCourse : c));
    } else {
      setCourses(prev => [...prev, editingCourse]);
    }
    setIsCourseModalOpen(false);
    setEditingCourse(null);
  };

  const handleDeleteCourse = (id: string) => {
    if(confirm("Ta bort denna byggsten?")) {
      setCourses(prev => prev.filter(c => c.id !== id));
    }
  };

  const openNewCourseModal = () => {
    setManualColor(false);
    setEditingCourse({
      id: uuidv4(),
      title: '',
      teacher: '',
      room: '',
      color: '#ffffff',
      duration: 60
    });
    setIsCourseModalOpen(true);
  };

  // --- Entry Handlers ---
  const handleSaveEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;
    setSchedule(prev => prev.map(entry => 
      entry.instanceId === editingEntry.instanceId ? editingEntry : entry
    ));
    setIsEntryModalOpen(false);
    setEditingEntry(null);
  };

  const handleRemoveEntry = (instanceId: string) => {
    setSchedule(prev => prev.filter(e => e.instanceId !== instanceId));
  };

  // --- Time Handlers ---
  const addTimeSlot = () => setTimeSlots(prev => [...prev, { id: uuidv4(), label: 'Ny tid' }]);
  const updateTimeSlot = (id: string, label: string) => setTimeSlots(prev => prev.map(slot => slot.id === id ? { ...slot, label } : slot));
  const removeTimeSlot = (id: string) => {
    setTimeSlots(prev => prev.filter(slot => slot.id !== id));
    setSchedule(prev => prev.filter(entry => entry.slotId !== id));
  };

  // --- Restriction Handlers ---
  const addRestriction = () => {
    if(!newRule.subjectA || !newRule.subjectB) return;
    setRestrictions(prev => [...prev, { ...newRule, id: uuidv4() }]);
    setNewRule({ id: '', subjectA: '', subjectB: '' });
  };

  const removeRestriction = (id: string) => {
    setRestrictions(prev => prev.filter(r => r.id !== id));
  };

  const exportPDF = async () => {
    const element = document.getElementById('planner-grid');
    if (!element) return;
    try {
      const canvas = await html2canvas(element, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('landscape', 'pt', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgProps = pdf.getImageProperties(imgData);
      const ratio = Math.min(pdfWidth / imgProps.width, pdfHeight / imgProps.height);
      const width = imgProps.width * ratio;
      const height = imgProps.height * ratio;
      const x = (pdfWidth - width) / 2;
      const y = 20;
      pdf.text("Schema", 40, 30);
      pdf.addImage(imgData, 'PNG', x, 50, width, height);
      pdf.save('schema.pdf');
    } catch (err) {
      console.error("Export failed", err);
    }
  };

  return (
    <DndContext 
      sensors={sensors} 
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      modifiers={[restrictToWindowEdges]}
    >
      <div className="space-y-6 pb-20">
        
        {/* Top Bar */}
        <div className="rounded-xl border-2 border-black bg-white p-4 shadow-[4px_4px_0px_rgba(0,0,0,1)] flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div>
            <h1 className="font-monument text-2xl">Schemaplanerare</h1>
            <p className="text-sm text-gray-600">Dra kort, filtrera och hantera regler.</p>
          </div>

          {/* Filter Input */}
          <div className="flex-1 max-w-md mx-4">
            <div className="relative">
              <Input 
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Filter: matte + hanna; -eng..."
                className="border-2 border-black shadow-sm pl-10"
              />
              <div className="absolute left-3 top-2.5 text-gray-400">
                🔍
              </div>
            </div>
            <p className="text-[10px] text-gray-500 mt-1">
              Ex: &quot;matte + 1a; svenska; -prov&quot; (Semikolon=ELLER, Plus=OCH, Minus=INTE)
            </p>
          </div>

          <div className="flex gap-2 flex-wrap">
             <Button variant="neutral" onClick={() => setIsRestrictionsModalOpen(true)} className="border-2 border-black bg-amber-100 hover:bg-amber-200">
                <ShieldAlert size={16} className="mr-2"/> Regler
             </Button>
             <Button variant="neutral" onClick={() => setIsTimeModalOpen(true)} className="border-2 border-black">
                <Clock size={16} className="mr-2"/> Tider
             </Button>
             <Button variant="neutral" onClick={exportPDF} className="border-2 border-black">
                <Download size={16} className="mr-2"/> PDF
             </Button>
             <Button 
               variant="neutral" 
               onClick={() => { if(confirm("Rensa hela schemat?")) setSchedule([]); }} 
               className="border-2 border-black bg-rose-100 hover:bg-rose-200 text-rose-800"
             >
                <RefreshCcw size={16} className="mr-2"/> Rensa
             </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Sidebar: Courses */}
          <div className="lg:col-span-1 space-y-4">
            <div className="rounded-xl border-2 border-black bg-white p-4 shadow-[4px_4px_0px_rgba(0,0,0,1)] h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-lg flex items-center gap-2">
                  <Settings size={18}/> Byggstenar
                </h2>
                <Button size="sm" onClick={openNewCourseModal} className="h-8 w-8 p-0 rounded-full border-2 border-black bg-[#aee8fe]">
                  <Plus size={18} />
                </Button>
              </div>
              
              {/* Filtered List */}
              <div className="space-y-2 flex-1 overflow-y-auto max-h-[500px] pr-1">
                {courses.map(course => {
                  const isMatch = advancedFilterMatch(course, filterQuery);
                  return (
                    <CourseCard 
                      key={course.id} 
                      course={course} 
                      onEdit={(c) => { setManualColor(true); setEditingCourse(c); setIsCourseModalOpen(true); }}
                      onDelete={handleDeleteCourse}
                      hidden={!isMatch}
                    />
                  );
                })}
              </div>

              {/* Mini Statistics */}
              <div className="mt-4 pt-4 border-t-2 border-gray-100">
                <div className="flex items-center gap-2 mb-2 text-gray-500">
                  <BarChart3 size={14} /> 
                  <span className="text-xs font-bold uppercase">Statistik (Filtrerat)</span>
                </div>
                <div className="space-y-1 text-xs">
                  {scheduleStats.length === 0 ? (
                    <span className="text-gray-400 italic">Inget schemalagt</span>
                  ) : (
                    scheduleStats.slice(0, 5).map(([title, minutes]) => (
                      <div key={title} className="flex justify-between">
                        <span>{title}</span>
                        <span className="font-mono font-bold">{minutes} min</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Main: Schedule Grid */}
          <div className="lg:col-span-3">
            <div id="planner-grid" className="rounded-xl border-2 border-black bg-gray-50 p-4 overflow-x-auto shadow-[4px_4px_0px_rgba(0,0,0,1)]">
              <div className="min-w-[700px]">
                {/* Header Row */}
                <div className="grid grid-cols-[100px_repeat(5,1fr)] gap-2 mb-2">
                   <div className="flex items-center justify-center font-bold text-gray-400 text-xs uppercase">Tid</div>
                   {days.map(day => (
                     <div key={day} className="bg-white border-2 border-black p-2 text-center font-bold text-sm rounded-lg shadow-sm">
                       {day}
                     </div>
                   ))}
                </div>

                {/* Time Slots */}
                <div className="space-y-2">
                  {timeSlots.map(slot => (
                    <div key={slot.id} className="grid grid-cols-[100px_repeat(5,1fr)] gap-2 min-h-[80px]">
                      <div className="flex items-center justify-center text-center text-xs font-semibold bg-white border border-gray-300 rounded p-2">
                        {slot.label}
                      </div>
                      {days.map(day => (
                        <ScheduleCell key={`${day}::${slot.id}`} day={day} slotId={slot.id}>
                          {schedule
                            .filter(e => e.day === day && e.slotId === slot.id)
                            .map(entry => {
                                const isMatch = advancedFilterMatch(entry, filterQuery);
                                return (
                                  <ScheduledCard 
                                    key={entry.instanceId} 
                                    entry={entry} 
                                    onRemove={handleRemoveEntry}
                                    onEdit={(e) => { setEditingEntry(e); setIsEntryModalOpen(true); }}
                                    hidden={!isMatch}
                                  />
                                )
                            })}
                        </ScheduleCell>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }) }}>
        {activeDragItem ? (
          'title' in activeDragItem && 'instanceId' in activeDragItem ? (
            <div className="planner-card w-[140px] opacity-90 shadow-xl" style={{ backgroundColor: activeDragItem.color }}>
               <p className="text-sm font-bold">{activeDragItem.title}</p>
            </div>
          ) : (
            <CourseCard course={activeDragItem as PlannerCourse} isOverlay />
          )
        ) : null}
      </DragOverlay>

      {/* --- MODALS --- */}

      {/* 1. Course Edit/Create Modal */}
      <Dialog open={isCourseModalOpen} onOpenChange={setIsCourseModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{courses.some(c => c.id === editingCourse?.id) ? 'Redigera Byggsten' : 'Ny Byggsten'}</DialogTitle>
          </DialogHeader>
          {editingCourse && (
            <form onSubmit={handleSaveCourse} className="space-y-4">
              <div className="space-y-2">
                <Label>Ämne / Titel</Label>
                <Input 
                  value={editingCourse.title} 
                  onChange={e => {
                    const newTitle = e.target.value;
                    let newColor = editingCourse.color;
                    if (!manualColor && newTitle.length > 1) {
                      newColor = generateBoxColor(newTitle);
                    }
                    setEditingCourse({...editingCourse, title: newTitle, color: newColor});
                  }} 
                  placeholder="t.ex. Matematik"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Lärare (valfritt)</Label>
                  <Input 
                    value={editingCourse.teacher} 
                    onChange={e => setEditingCourse({...editingCourse, teacher: e.target.value})} 
                    placeholder="t.ex. A. Svensson"
                  />
                </div>
                <div className="space-y-2">
                   <Label>Sal (valfritt)</Label>
                   <Input 
                     value={editingCourse.room} 
                     onChange={e => setEditingCourse({...editingCourse, room: e.target.value})} 
                     placeholder="t.ex. B123"
                   />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Färg</Label>
                <div className="flex gap-2 flex-wrap">
                  {palette.map(c => (
                    <button
                      key={c}
                      type="button"
                      className={`w-8 h-8 rounded-full border-2 ${editingCourse.color === c ? 'border-black scale-110' : 'border-transparent hover:scale-105'}`}
                      style={{ backgroundColor: c }}
                      onClick={() => {
                        setManualColor(true);
                        setEditingCourse({...editingCourse, color: c});
                      }}
                    />
                  ))}
                  <div className="ml-auto flex items-center gap-2">
                     <div className="w-8 h-8 rounded-full border-2 border-black" style={{ backgroundColor: editingCourse.color }} />
                     <span className="text-xs text-gray-500">{manualColor ? '(Manuell)' : '(Auto)'}</span>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="neutral" onClick={() => setIsCourseModalOpen(false)}>Avbryt</Button>
                <Button type="submit" className="bg-green-200 hover:bg-green-300 text-black border-2 border-black">Spara</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* 2. Schedule Entry Edit Modal */}
      <Dialog open={isEntryModalOpen} onOpenChange={setIsEntryModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redigera Lektion</DialogTitle>
          </DialogHeader>
          {editingEntry && (
            <form onSubmit={handleSaveEntry} className="space-y-4">
              <div className="space-y-2">
                <Label>Titel</Label>
                <Input 
                  value={editingEntry.title} 
                  onChange={e => setEditingEntry({...editingEntry, title: e.target.value})} 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Lärare</Label>
                  <Input 
                    value={editingEntry.teacher} 
                    onChange={e => setEditingEntry({...editingEntry, teacher: e.target.value})} 
                  />
                </div>
                <div className="space-y-2">
                   <Label>Sal</Label>
                   <Input 
                     value={editingEntry.room} 
                     onChange={e => setEditingEntry({...editingEntry, room: e.target.value})} 
                   />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Färg</Label>
                <div className="flex gap-2 flex-wrap">
                  {palette.map(c => (
                    <button
                      key={c}
                      type="button"
                      className={`w-8 h-8 rounded-full border-2 ${editingEntry.color === c ? 'border-black scale-110' : 'border-transparent hover:scale-105'}`}
                      style={{ backgroundColor: c }}
                      onClick={() => setEditingEntry({...editingEntry, color: c})}
                    />
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="neutral" onClick={() => setIsEntryModalOpen(false)}>Avbryt</Button>
                <Button type="submit" className="bg-green-200 border-2 border-black text-black">Uppdatera</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* 3. Time Slots Management Modal */}
      <Dialog open={isTimeModalOpen} onOpenChange={setIsTimeModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Hantera Tider</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {timeSlots.map((slot, index) => (
              <div key={slot.id} className="flex gap-2 items-center">
                <span className="text-xs font-bold text-gray-400 w-6">#{index + 1}</span>
                <Input 
                  value={slot.label} 
                  onChange={(e) => updateTimeSlot(slot.id, e.target.value)}
                  className="flex-1"
                />
                <Button 
                  type="button" 
                  variant="neutral" 
                  size="icon"
                  onClick={() => removeTimeSlot(slot.id)}
                  className="h-10 w-10 text-rose-500 hover:bg-rose-50"
                >
                  <Trash2 size={16}/>
                </Button>
              </div>
            ))}
            <Button 
              onClick={addTimeSlot} 
              className="w-full border-dashed border-2 border-gray-300 bg-transparent text-gray-500 hover:bg-gray-50"
            >
              <Plus size={16} className="mr-2"/> Lägg till ny tid
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsTimeModalOpen(false)}>Klar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 4. Restrictions Manager */}
      <Dialog open={isRestrictionsModalOpen} onOpenChange={setIsRestrictionsModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Krockregler</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
             <p className="text-sm text-gray-500">
               Skapa regler för ämnen som inte får ligga samtidigt. Använd * som wildcard.
               Ex: &quot;Matte*&quot; krockar med &quot;Svenska*&quot;.
             </p>
             
             <div className="flex gap-2 items-end bg-amber-50 p-3 rounded-lg border border-amber-200">
               <div className="flex-1">
                  <Label className="text-xs">Ämne/Grupp A</Label>
                  <Input 
                    value={newRule.subjectA} 
                    onChange={e => setNewRule({...newRule, subjectA: e.target.value})}
                    placeholder="t.ex. Matte*" 
                  />
               </div>
               <div className="flex items-center pb-2 font-bold text-gray-400">⟷</div>
               <div className="flex-1">
                  <Label className="text-xs">Ämne/Grupp B</Label>
                  <Input 
                    value={newRule.subjectB} 
                    onChange={e => setNewRule({...newRule, subjectB: e.target.value})}
                    placeholder="t.ex. Svenska*" 
                  />
               </div>
               <Button onClick={addRestriction} className="bg-black text-white">
                 <Plus size={16} />
               </Button>
             </div>

             <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {restrictions.length === 0 && <p className="text-center text-gray-400 text-sm py-4">Inga regler definierade</p>}
                {restrictions.map(r => (
                  <div key={r.id} className="flex items-center justify-between p-2 border rounded bg-white shadow-sm">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-bold bg-gray-100 px-2 py-0.5 rounded">{r.subjectA}</span>
                      <span className="text-gray-400 text-xs">får ej krocka med</span>
                      <span className="font-bold bg-gray-100 px-2 py-0.5 rounded">{r.subjectB}</span>
                    </div>
                    <Button size="icon" variant="neutral" onClick={() => removeRestriction(r.id)} className="h-6 w-6 text-gray-400 hover:text-rose-500">
                      <X size={14} />
                    </Button>
                  </div>
                ))}
             </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsRestrictionsModalOpen(false)}>Klar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </DndContext>
  );
}