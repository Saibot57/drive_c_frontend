import { ScheduledEntry } from '@/types/schedule';
import { checkOverlap } from '@/utils/scheduleTime';

/**
 * "Mina lektioner" på den publika schemalänken: vilka pass en deltagare ska se
 * utifrån temaklass och mattekurs.
 *
 * Schemat är byggt av två parallella block:
 *
 * - **Tema.** Tema Grund, Tema Oliv och Tema Rosa går samtidigt i varsin sal.
 *   Man ser sin egen klass.
 * - **Matte.** Ma Grund, Ma 1 och Studieverkstad går samtidigt. Den som inte
 *   läser matte går till Studieverkstad. Ma 2 har egna pass (onsdag och fredag
 *   eftermiddag i v. 40) och går till Studieverkstad under matteblocket — så
 *   har arbetslaget bestämt, det går inte att läsa ut ur schemat.
 *
 * Allt annat — lunch, paus, Onsdagsklubben, och varje pass som läggs till
 * senare — visas för alla. Ett okänt pass får aldrig försvinna av misstag;
 * hellre ett pass för mycket än att någon missar något gemensamt.
 *
 * Titlarna matchas tolerant: skiftläge och extra mellanslag spelar ingen roll
 * ("Ma  Grund" förekom i v. 40), och "Ma2 (tillval)", "Ma 2" och "Matte 2"
 * räknas som samma kurs.
 */

export type TemaClass = 'grund' | 'oliv' | 'rosa';
export type MathCourse = 'grund' | '1' | '2' | 'ingen';

export type ParticipantChoice = {
  tema: TemaClass;
  math: MathCourse;
};

export const TEMA_OPTIONS: { value: TemaClass; label: string }[] = [
  { value: 'grund', label: 'Grund' },
  { value: 'rosa', label: 'Rosa' },
  { value: 'oliv', label: 'Oliv' },
];

export const MATH_OPTIONS: { value: MathCourse; label: string }[] = [
  { value: 'grund', label: 'Matte Grund' },
  { value: '1', label: 'Matte 1' },
  { value: '2', label: 'Matte 2' },
  { value: 'ingen', label: 'Läser ingen matte' },
];

type PassKind =
  | { kind: 'tema'; tema: TemaClass }
  | { kind: 'math'; course: Exclude<MathCourse, 'ingen'> }
  | { kind: 'studieverkstad' }
  | { kind: 'common' };

const normalize = (title: string) =>
  title.toLocaleLowerCase('sv').replace(/\s+/g, ' ').trim();

const TEMA_PATTERN = /^tema (grund|oliv|rosa)\b/;
const MATH_PATTERN = /^(?:ma|matte|matematik) ?(grund|1|2)\b/;
const STUDIEVERKSTAD_PATTERN = /^studieverkstad\b/;

export const classifyPass = (title: string): PassKind => {
  const text = normalize(title ?? '');

  const tema = text.match(TEMA_PATTERN);
  if (tema) return { kind: 'tema', tema: tema[1] as TemaClass };

  const math = text.match(MATH_PATTERN);
  if (math) return { kind: 'math', course: math[1] as Exclude<MathCourse, 'ingen'> };

  if (STUDIEVERKSTAD_PATTERN.test(text)) return { kind: 'studieverkstad' };

  return { kind: 'common' };
};

/**
 * Passen deltagaren ska se, i ursprunglig ordning.
 *
 * Studieverkstaden avgörs av vad som går samtidigt, inte av en tabell över
 * tider: den döljs bara för den vars egen mattekurs pågår parallellt. Då blir
 * torsdagens ensamma studieverkstad synlig för alla, och en studieverkstad som
 * flyttas nästa vecka följer med utan att något behöver ändras här.
 */
export const filterForParticipant = (
  entries: ScheduledEntry[],
  choice: ParticipantChoice
): ScheduledEntry[] => {
  const kinds = new Map(entries.map(entry => [entry.instanceId, classifyPass(entry.title)]));

  return entries.filter(entry => {
    const kind = kinds.get(entry.instanceId)!;
    switch (kind.kind) {
      case 'common':
        return true;
      case 'tema':
        return kind.tema === choice.tema;
      case 'math':
        return kind.course === choice.math;
      case 'studieverkstad': {
        const ownCourseAtSameTime = entries.some(other => {
          const otherKind = kinds.get(other.instanceId)!;
          return otherKind.kind === 'math'
            && otherKind.course === choice.math
            && other.day === entry.day
            && checkOverlap(entry.startTime, entry.endTime, other.startTime, other.endTime);
        });
        return !ownCourseAtSameTime;
      }
    }
  });
};

/** "Tema Oliv · Matte 1" — för raden som talar om vad som visas. */
export const describeChoice = (choice: ParticipantChoice) => {
  const tema = TEMA_OPTIONS.find(option => option.value === choice.tema)?.label ?? choice.tema;
  const math = MATH_OPTIONS.find(option => option.value === choice.math)?.label ?? choice.math;
  return `Tema ${tema} · ${math}`;
};

/** Tvättar ett sparat val. Webbläsarens lagring kan innehålla vad som helst. */
export const sanitizeChoice = (input: unknown): ParticipantChoice | null => {
  if (!input || typeof input !== 'object') return null;
  const { tema, math } = input as Record<string, unknown>;
  const validTema = TEMA_OPTIONS.some(option => option.value === tema);
  const validMath = MATH_OPTIONS.some(option => option.value === math);
  return validTema && validMath ? { tema: tema as TemaClass, math: math as MathCourse } : null;
};
