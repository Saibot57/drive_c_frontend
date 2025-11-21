'use client';

import React, { useEffect, useState } from 'react';
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

const STORAGE_KEY = 'drive-c-schedule-planner-v3';

const days = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag'];

// Uppdaterad palett med hex-koder (Dova men inte bleka)
const palette = [
  '#ffffff', // Vit
  '#fde68a', // Amber 200
  '#bae6fd', // Sky 200
  '#d9f99d', // Lime 200
  '#fecdd3', // Rose 200
  '#c7d2fe', // Indigo 200
  '#a7f3d0', // Emerald 200
  '#ddd6fe', // Violet 200
  '#fed7aa'  // Orange 200
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
  category?: string; // Lade till denna rad för att fixa felet
}

interface ScheduledEntry extends PlannerCourse {
  instanceId: string;
  day: string;
  slotId: string;
}

interface PersistedPlannerState {
  courses: PlannerCourse[];
  schedule: ScheduledEntry[];
  timeSlots: TimeSlot[];
}

const baseCourses: PlannerCourse[] = [
  {
    id: 'course-1',
    title: 'Matematik A',
    teacher: 'L. Holm',
    duration: 60,
    color: '#fde68a', // Amber
    category: 'Natur',
    room: 'A1'
  },
  {
    id: 'course-2',
    title: 'Svenska',
    teacher: 'E. Ström',
    duration: 60,
    color: '#bae6fd', // Sky
    category: 'Språk',
    room: 'B2'
  },
  {
    id: 'course-3',
    title: 'Engelska',
    teacher: 'M. Khan',
    duration: 60,
    color: '#d9f99d', // Lime
    category: 'Språk',
    room: 'C3'
  },
  {
    id: 'course-5',
    title: 'Programmering',
    teacher: 'J. Rivera',
    duration: 90,
    color: '#c7d2fe', // Indigo
    category: 'Teknik',
    room: 'Lab 1'
  }
];

// --- Components ---

function CourseCard({ course, onEdit, onDelete, isOverlay }: { 
  course: PlannerCourse; 
  onEdit?: (c: PlannerCourse) => void; 
  onDelete?: (id: string) => void;
  isOverlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: course.id,
    data: { type: 'course', course },
    disabled: isOverlay 
  });

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
      className={`planner-card relative group ${
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
  onEdit
}: {
  entry: ScheduledEntry;
  onRemove: (id: string) => void;
  onEdit: (entry: ScheduledEntry) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: entry.instanceId,
    data: { type: 'scheduled', entry },
  });

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

  const [activeDragItem, setActiveDragItem] = useState<PlannerCourse | ScheduledEntry | null>(null);

  // Modals
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<PlannerCourse | null>(null);
  const [manualColor, setManualColor] = useState(false);
  
  const [isTimeModalOpen, setIsTimeModalOpen] = useState(false);
  
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ScheduledEntry | null>(null);

  // --- Sensors ---
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
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
      } catch (e) {
        console.error("Failed to load schedule", e);
      }
    } else {
      setCourses(baseCourses);
    }
  }, []);

  useEffect(() => {
    const payload: PersistedPlannerState = { courses, schedule, timeSlots };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [courses, schedule, timeSlots]);

  // Initiera färgsystemet med befintliga kurser för att hitta likheter
  useEffect(() => {
    const colorMap = courses.map(c => ({ className: c.title, color: c.color }));
    importColors(colorMap);
  }, [courses]);

  // --- Handlers ---

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

  const openEditCourseModal = (course: PlannerCourse) => {
    setManualColor(true);
    setEditingCourse(course);
    setIsCourseModalOpen(true);
  };

  // --- Handlers: Schedule Entry Management ---
  
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

  // --- Time Slots ---

  const addTimeSlot = () => {
    const newSlot: TimeSlot = { id: uuidv4(), label: 'Ny tid' };
    setTimeSlots(prev => [...prev, newSlot]);
  };

  const updateTimeSlot = (id: string, label: string) => {
    setTimeSlots(prev => prev.map(slot => slot.id === id ? { ...slot, label } : slot));
  };

  const removeTimeSlot = (id: string) => {
    setTimeSlots(prev => prev.filter(slot => slot.id !== id));
    setSchedule(prev => prev.filter(entry => entry.slotId !== id));
  };

  // --- Export ---
  
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
        
        <div className="rounded-xl border-2 border-black bg-white p-4 shadow-[4px_4px_0px_rgba(0,0,0,1)] flex flex-wrap gap-4 items-center justify-between">
          <div>
            <h1 className="font-monument text-2xl">Schemaplanerare</h1>
            <p className="text-sm text-gray-600">Skapa byggstenar och planera schemat.</p>
          </div>
          <div className="flex gap-2">
             <Button variant="neutral" onClick={() => setIsTimeModalOpen(true)} className="border-2 border-black">
                <Clock size={16} className="mr-2"/> Tider
             </Button>
             <Button variant="neutral" onClick={exportPDF} className="border-2 border-black">
                <Download size={16} className="mr-2"/> PDF
             </Button>
             <Button 
               variant="neutral" 
               onClick={() => {
                 if(confirm("Är du säker på att du vill rensa hela schemat?")) {
                   setSchedule([]);
                 }
               }} 
               className="border-2 border-black bg-rose-100 hover:bg-rose-200 text-rose-800"
             >
                <RefreshCcw size={16} className="mr-2"/> Rensa
             </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            <div className="rounded-xl border-2 border-black bg-white p-4 shadow-[4px_4px_0px_rgba(0,0,0,1)] h-full">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-lg flex items-center gap-2">
                  <Settings size={18}/> Byggstenar
                </h2>
                <Button size="sm" onClick={openNewCourseModal} className="h-8 w-8 p-0 rounded-full border-2 border-black bg-[#aee8fe]">
                  <Plus size={18} />
                </Button>
              </div>
              
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {courses.length === 0 && (
                  <p className="text-sm text-gray-500 italic text-center py-4">
                    Inga ämnen skapade än. Tryck på + för att börja.
                  </p>
                )}
                {courses.map(course => (
                  <CourseCard 
                    key={course.id} 
                    course={course} 
                    onEdit={openEditCourseModal}
                    onDelete={handleDeleteCourse}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Main Grid */}
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
                            .map(entry => (
                              <ScheduledCard 
                                key={entry.instanceId} 
                                entry={entry} 
                                onRemove={handleRemoveEntry}
                                onEdit={(e) => { setEditingEntry(e); setIsEntryModalOpen(true); }}
                              />
                            ))}
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
                    // Auto-generate color if not manually set
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

    </DndContext>
  );
}