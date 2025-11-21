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
} from '@dnd-kit/core';
import { restrictToParentElement } from '@dnd-kit/modifiers';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
  AlertTriangle,
  CalendarRange,
  Download,
  Filter,
  Printer,
  RefreshCcw,
  Trash2,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = 'drive-c-schedule-planner';

const days = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag'];

const timeSlots = [
  { id: '08:00', label: '08:00 - 09:00' },
  { id: '09:00', label: '09:00 - 10:00' },
  { id: '10:15', label: '10:15 - 11:15' },
  { id: '11:30', label: '11:30 - 12:30' },
  { id: '13:00', label: '13:00 - 14:00' },
  { id: '14:15', label: '14:15 - 15:15' },
];

const palette = ['bg-amber-200', 'bg-sky-200', 'bg-lime-200', 'bg-rose-200', 'bg-indigo-200', 'bg-emerald-200'];

interface PlannerCourse {
  id: string;
  title: string;
  teacher: string;
  duration: number;
  color: string;
  category: string;
  room: string;
  preferredDays?: string[];
}

interface ScheduledEntry {
  id: string;
  courseId: string;
  day: string;
  slotId: string;
  title: string;
  teacher: string;
  color: string;
  room: string;
  duration: number;
}

interface RestrictionSettings {
  lockPreferredDays: boolean;
  avoidTeacherOverlap: boolean;
  maxPerDay: number;
}

interface PersistedPlannerState {
  courses: PlannerCourse[];
  schedule: ScheduledEntry[];
  restrictions: RestrictionSettings;
}

const baseCourses: PlannerCourse[] = [
  {
    id: 'course-1',
    title: 'Matematik A',
    teacher: 'L. Holm',
    duration: 60,
    color: palette[0],
    category: 'Natur',
    room: 'A1',
    preferredDays: ['Måndag', 'Onsdag'],
  },
  {
    id: 'course-2',
    title: 'Svenska',
    teacher: 'E. Ström',
    duration: 60,
    color: palette[1],
    category: 'Språk',
    room: 'B2',
    preferredDays: ['Tisdag', 'Torsdag'],
  },
  {
    id: 'course-3',
    title: 'Engelska',
    teacher: 'M. Khan',
    duration: 60,
    color: palette[2],
    category: 'Språk',
    room: 'C3',
    preferredDays: ['Måndag', 'Fredag'],
  },
  {
    id: 'course-4',
    title: 'Historia',
    teacher: 'S. Öberg',
    duration: 60,
    color: palette[3],
    category: 'Samhälle',
    room: 'D4',
    preferredDays: ['Onsdag'],
  },
  {
    id: 'course-5',
    title: 'Programmering',
    teacher: 'J. Rivera',
    duration: 90,
    color: palette[4],
    category: 'Teknik',
    room: 'Lab 1',
    preferredDays: ['Torsdag'],
  },
  {
    id: 'course-6',
    title: 'Fysik',
    teacher: 'T. Nilsson',
    duration: 60,
    color: palette[5],
    category: 'Natur',
    room: 'A2',
    preferredDays: ['Tisdag', 'Fredag'],
  },
];

function CourseCard({ course }: { course: PlannerCourse }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: course.id,
    data: { type: 'course', course },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`planner-card ${course.color} ${
        isDragging ? 'opacity-75 ring-2 ring-offset-2 ring-black' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-gray-900">{course.title}</p>
          <p className="text-xs text-gray-700">{course.teacher}</p>
          <p className="text-[11px] text-gray-600">Rum {course.room}</p>
          <p className="text-[11px] text-gray-600">{course.duration} min</p>
        </div>
        <span className="rounded-full bg-black/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-800">
          {course.category}
        </span>
      </div>
      {course.preferredDays?.length ? (
        <p className="mt-2 text-[11px] font-medium text-gray-800">
          Prioriterade dagar: {course.preferredDays.join(', ')}
        </p>
      ) : null}
    </div>
  );
}

function ScheduleCell({
  day,
  slotId,
  children,
}: {
  day: string;
  slotId: string;
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `${day}-${slotId}`,
    data: { day, slotId },
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[120px] flex-col gap-2 rounded-xl border-2 border-black bg-white p-2 transition-all ${
        isOver ? 'shadow-[4px_4px_0px_rgba(0,0,0,1)]' : ''
      }`}
    >
      {children}
    </div>
  );
}

function ScheduledCard({
  entry,
  onRemove,
}: {
  entry: ScheduledEntry;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: entry.id,
    data: { type: 'scheduled', entry },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <article
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`planner-card ${entry.color} ${isDragging ? 'opacity-80 ring-2 ring-offset-2 ring-black' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-gray-900">{entry.title}</h4>
          <p className="text-xs text-gray-700">{entry.teacher}</p>
          <p className="text-[11px] text-gray-700">Rum {entry.room}</p>
          <p className="text-[11px] text-gray-700">{entry.duration} min</p>
        </div>
        <button
          type="button"
          onClick={() => onRemove(entry.id)}
          className="rounded-full border-2 border-black bg-white p-1 text-gray-800 transition hover:-translate-y-0.5 hover:translate-x-0.5 hover:shadow-[2px_2px_0px_rgba(0,0,0,1)]"
          aria-label="Ta bort lektion"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}

function SectionHeader({ icon: Icon, title }: { icon: React.ComponentType<{ className?: string }>; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-black bg-amber-100 text-black">
        <Icon className="h-4 w-4" />
      </div>
      <h2 className="font-monument text-xl">{title}</h2>
    </div>
  );
}

export default function NewSchedulePlanner() {
  const [courses, setCourses] = useState<PlannerCourse[]>(baseCourses);
  const [schedule, setSchedule] = useState<ScheduledEntry[]>([]);
  const [restrictions, setRestrictions] = useState<RestrictionSettings>({
    lockPreferredDays: true,
    avoidTeacherOverlap: true,
    maxPerDay: 4,
  });
  const [filter, setFilter] = useState('');
  const [category, setCategory] = useState('Alla');
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const [lastConflict, setLastConflict] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  );

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as PersistedPlannerState;
      setCourses(parsed.courses || baseCourses);
      setSchedule(parsed.schedule || []);
      setRestrictions(parsed.restrictions || restrictions);
    } catch (error) {
      console.error('Kunde inte läsa sparat schema', error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const payload: PersistedPlannerState = { courses, schedule, restrictions };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [courses, schedule, restrictions]);

  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      const matchesQuery = course.title.toLowerCase().includes(filter.toLowerCase()) ||
        course.teacher.toLowerCase().includes(filter.toLowerCase());
      const matchesCategory = category === 'Alla' || course.category === category;
      const matchesDay = !activeDay || course.preferredDays?.includes(activeDay);
      return matchesQuery && matchesCategory && matchesDay;
    });
  }, [courses, filter, category, activeDay]);

  const dayCounts = useMemo(() => {
    return days.reduce<Record<string, number>>((acc, day) => {
      acc[day] = schedule.filter((entry) => entry.day === day).length;
      return acc;
    }, {});
  }, [schedule]);

  const checkConflicts = (targetDay: string, slotId: string, course: PlannerCourse, movingId?: string) => {
    const sameSlot = schedule.find(
      (entry) => entry.day === targetDay && entry.slotId === slotId && entry.id !== movingId
    );
    if (sameSlot) return 'Tidsluckan är redan upptagen.';

    if (restrictions.avoidTeacherOverlap) {
      const teacherBusy = schedule.find(
        (entry) =>
          entry.day === targetDay &&
          entry.slotId === slotId &&
          entry.teacher === course.teacher &&
          entry.id !== movingId
      );
      if (teacherBusy) return 'Läraren är redan bokad den tiden.';
    }

    if (restrictions.lockPreferredDays && course.preferredDays?.length) {
      if (!course.preferredDays.includes(targetDay)) {
        return 'Denna kursen har andra prioriterade dagar.';
      }
    }

    const max = restrictions.maxPerDay;
    if (max > 0) {
      const total = schedule.filter((entry) => entry.day === targetDay && entry.id !== movingId).length;
      if (total >= max) return 'Dagens gräns är nådd. Justera regler eller välj annan dag.';
    }

    return null;
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const dropData = over.data.current as { day?: string; slotId?: string } | undefined;
    if (!dropData?.day || !dropData?.slotId) return;

    const type = active.data.current?.type as 'course' | 'scheduled' | undefined;
    if (!type) return;

    if (type === 'course') {
      const course = active.data.current?.course as PlannerCourse;
      const conflict = checkConflicts(dropData.day, dropData.slotId, course);
      if (conflict) {
        setLastConflict(conflict);
        return;
      }

      const entry: ScheduledEntry = {
        id: uuidv4(),
        courseId: course.id,
        day: dropData.day,
        slotId: dropData.slotId,
        title: course.title,
        teacher: course.teacher,
        color: course.color,
        room: course.room,
        duration: course.duration,
      };
      setSchedule((prev) => [...prev, entry]);
      setLastConflict(null);
      return;
    }

    const existing = active.data.current?.entry as ScheduledEntry | undefined;
    if (!existing) return;
    const course = courses.find((c) => c.id === existing.courseId) || {
      ...existing,
      preferredDays: [],
      category: 'Annat',
      room: existing.room,
    };

    const conflict = checkConflicts(dropData.day, dropData.slotId, course as PlannerCourse, existing.id);
    if (conflict) {
      setLastConflict(conflict);
      return;
    }

    setSchedule((prev) =>
      prev.map((entry) =>
        entry.id === existing.id
          ? { ...entry, day: dropData.day!, slotId: dropData.slotId! }
          : entry
      )
    );
    setLastConflict(null);
  };

  const removeEntry = (id: string) => {
    setSchedule((prev) => prev.filter((entry) => entry.id !== id));
  };

  const clearSchedule = () => {
    setSchedule([]);
    setLastConflict(null);
  };

  const resetPlanner = () => {
    setCourses(baseCourses);
    setSchedule([]);
    setRestrictions({ lockPreferredDays: true, avoidTeacherOverlap: true, maxPerDay: 4 });
    setLastConflict(null);
  };

  const exportPDF = async () => {
    const node = document.getElementById('planner-canvas');
    if (!node) return;

    const canvas = await html2canvas(node, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('landscape', 'pt', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
    const imgWidth = canvas.width * ratio;
    const imgHeight = canvas.height * ratio;

    pdf.addImage(imgData, 'PNG', (pageWidth - imgWidth) / 2, 20, imgWidth, imgHeight);
    pdf.save('schema.pdf');
  };

  const printPlanner = async () => {
    const node = document.getElementById('planner-canvas');
    if (!node) return;
    const canvas = await html2canvas(node, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    const printWindow = window.open('', 'PRINT', 'width=1024,height=768');
    if (!printWindow) return;
    printWindow.document.write(`<img src="${imgData}" style="width:100%" />`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const categories = useMemo(() => ['Alla', ...Array.from(new Set(courses.map((c) => c.category)))], [courses]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border-2 border-black bg-white p-4 shadow-[6px_6px_0px_rgba(0,0,0,1)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-600">Planeringsvy</p>
            <h1 className="font-monument text-3xl">Schemaplanerare</h1>
            <p className="text-sm text-gray-700">Dra kurser till rutnätet och säkra att regler och konflikter hanteras automatiskt.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={exportPDF}
              className="planner-btn"
            >
              <Download className="h-4 w-4" />
              Exportera PDF
            </button>
            <button
              type="button"
              onClick={printPlanner}
              className="planner-btn"
            >
              <Printer className="h-4 w-4" />
              Skriv ut
            </button>
            <button
              type="button"
              onClick={clearSchedule}
              className="planner-btn bg-rose-200 hover:bg-rose-300"
            >
              <Trash2 className="h-4 w-4" />
              Rensa schema
            </button>
            <button
              type="button"
              onClick={resetPlanner}
              className="planner-btn bg-sky-200 hover:bg-sky-300"
            >
              <RefreshCcw className="h-4 w-4" />
              Återställ
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border-2 border-black bg-white p-4 shadow-[6px_6px_0px_rgba(0,0,0,1)]">
            <SectionHeader icon={CalendarRange} title="Schema" />
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToParentElement]}
              onDragEnd={handleDragEnd}
            >
              <div id="planner-canvas" className="overflow-x-auto">
                <div className="min-w-[760px] rounded-xl border-2 border-black bg-gray-50 p-3">
                  <div className="grid grid-cols-6 gap-3">
                    <div />
                    {days.map((day) => (
                      <div key={day} className="rounded-lg border-2 border-black bg-amber-100 py-2 text-center font-semibold text-gray-900">
                        {day}
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 space-y-3">
                    {timeSlots.map((slot) => (
                      <div key={slot.id} className="grid grid-cols-6 gap-3">
                        <div className="flex items-center justify-between rounded-lg border-2 border-black bg-white px-3 py-2 font-semibold text-gray-800">
                          <span>{slot.label}</span>
                        </div>
                        {days.map((day) => (
                          <ScheduleCell key={`${day}-${slot.id}`} day={day} slotId={slot.id}>
                            {schedule
                              .filter((entry) => entry.day === day && entry.slotId === slot.id)
                              .map((entry) => (
                                <ScheduledCard key={entry.id} entry={entry} onRemove={removeEntry} />
                              ))}
                          </ScheduleCell>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </DndContext>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border-2 border-black bg-white p-4 shadow-[6px_6px_0px_rgba(0,0,0,1)]">
            <SectionHeader icon={Filter} title="Filtrera" />
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Sök kurs eller lärare"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full rounded-xl border-2 border-black px-3 py-2 text-sm shadow-[2px_2px_0px_rgba(0,0,0,1)] focus:outline-none"
              />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border-2 border-black px-3 py-2 text-sm shadow-[2px_2px_0px_rgba(0,0,0,1)] focus:outline-none"
              >
                {categories.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setActiveDay(null)}
                  className={`planner-chip ${activeDay === null ? 'bg-black text-white' : ''}`}
                >
                  Alla dagar
                </button>
                {days.map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setActiveDay(day)}
                    className={`planner-chip ${activeDay === day ? 'bg-black text-white' : ''}`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border-2 border-black bg-white p-4 shadow-[6px_6px_0px_rgba(0,0,0,1)]">
            <SectionHeader icon={AlertTriangle} title="Regler & Konflikter" />
            <div className="space-y-3 text-sm text-gray-800">
              <label className="flex items-center justify-between gap-3 rounded-xl border-2 border-black bg-amber-50 px-3 py-2">
                <span>Respektera prioriterade dagar</span>
                <input
                  type="checkbox"
                  checked={restrictions.lockPreferredDays}
                  onChange={(e) => setRestrictions((prev) => ({ ...prev, lockPreferredDays: e.target.checked }))}
                  className="h-4 w-4 rounded border-black"
                />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-xl border-2 border-black bg-amber-50 px-3 py-2">
                <span>Blockera lärarkrockar</span>
                <input
                  type="checkbox"
                  checked={restrictions.avoidTeacherOverlap}
                  onChange={(e) => setRestrictions((prev) => ({ ...prev, avoidTeacherOverlap: e.target.checked }))}
                  className="h-4 w-4 rounded border-black"
                />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-xl border-2 border-black bg-amber-50 px-3 py-2">
                <span>Max per dag</span>
                <input
                  type="number"
                  min={0}
                  value={restrictions.maxPerDay}
                  onChange={(e) =>
                    setRestrictions((prev) => ({ ...prev, maxPerDay: Number(e.target.value) }))
                  }
                  className="w-16 rounded-lg border-2 border-black px-2 py-1 text-sm"
                />
              </label>
              {lastConflict ? (
                <div className="rounded-xl border-2 border-black bg-rose-100 px-3 py-2 text-sm font-semibold text-rose-900">
                  {lastConflict}
                </div>
              ) : (
                <p className="text-xs text-gray-600">Dra kort för att schemalägga. Konfilkter visas här.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border-2 border-black bg-white p-4 shadow-[6px_6px_0px_rgba(0,0,0,1)]">
            <SectionHeader icon={Download} title="Tillgängliga kurser" />
            <div className="space-y-3">
              {filteredCourses.length === 0 ? (
                <p className="text-sm text-gray-700">Inga kurser matchar filtret.</p>
              ) : (
                filteredCourses.map((course) => <CourseCard key={course.id} course={course} />)
              )}
            </div>
          </div>

          <div className="rounded-2xl border-2 border-black bg-white p-4 shadow-[6px_6px_0px_rgba(0,0,0,1)]">
            <SectionHeader icon={CalendarRange} title="Översikt" />
            <div className="grid grid-cols-2 gap-3 text-sm">
              {days.map((day) => (
                <div key={day} className="rounded-xl border-2 border-black bg-amber-50 px-3 py-2">
                  <p className="font-semibold text-gray-800">{day}</p>
                  <p className="text-xs text-gray-700">{dayCounts[day] || 0} bokningar</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
