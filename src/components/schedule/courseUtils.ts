import { DEFAULT_COURSE_COLOR, DERIVED_COURSE_PREFIX } from '@/components/schedule/constants';
import { generateBoxColor } from '@/config/colorManagement';
import { PlannerCourse, ScheduledEntry } from '@/types/schedule';

const normalizeCoursePart = (value?: string) => (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

export const buildCourseDedupeKey = (course: Pick<PlannerCourse, 'title' | 'teacher' | 'room' | 'duration' | 'color' | 'category'>) => (
  [
    normalizeCoursePart(course.title),
    normalizeCoursePart(course.teacher),
    normalizeCoursePart(course.room),
    course.duration,
    normalizeCoursePart(course.color),
    normalizeCoursePart(course.category)
  ].join('|')
);

const hashStringFnv1a = (value: string) => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
};

export const deriveCoursesFromSchedule = (scheduleEntries: ScheduledEntry[]) => {
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
    mappedCourse.id = `${DERIVED_COURSE_PREFIX}${hashStringFnv1a(dedupeKey)}`;
    unique.set(dedupeKey, mappedCourse);
  });

  return Array.from(unique.values()).sort((a, b) => a.title.localeCompare(b.title, 'sv'));
};

export const sanitizeManualCourses = (input: unknown): PlannerCourse[] => {
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
      color: typeof raw.color === 'string' ? raw.color : DEFAULT_COURSE_COLOR,
      duration: typeof raw.duration === 'number' && !Number.isNaN(raw.duration) ? raw.duration : 60,
      category: typeof raw.category === 'string' ? raw.category : undefined
    }];
  });
};

export const mergeCourses = (manual: PlannerCourse[], derived: PlannerCourse[]) => {
  const merged = new Map<string, PlannerCourse>();
  manual.forEach(course => merged.set(buildCourseDedupeKey(course), course));
  derived.forEach(course => {
    const key = buildCourseDedupeKey(course);
    if (!merged.has(key)) merged.set(key, course);
  });
  return Array.from(merged.values()).sort((a, b) => a.title.localeCompare(b.title, 'sv'));
};
