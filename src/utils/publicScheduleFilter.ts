import { ScheduledEntry } from '@/types/schedule';
import { checkOverlap } from '@/utils/scheduleTime';

/**
 * "Mina lektioner" på den publika schemalänken: vilka pass en deltagare ska se
 * utifrån temaklass, mattekurs och engelskkurs.
 *
 * Schemat är byggt av tre parallella block:
 *
 * - **Tema.** Tema Grund, Tema Oliv och Tema Rosa går samtidigt i varsin sal.
 *   Man ser sin egen klass.
 * - **Matte.** Ma Grund, Ma 1 och Studieverkstad går samtidigt. Den som inte
 *   läser matte går till Studieverkstad. Ma 2 har egna pass (onsdag och fredag
 *   eftermiddag i v. 40) och går till Studieverkstad under matteblocket — så
 *   har arbetslaget bestämt, det går inte att läsa ut ur schemat.
 * - **Engelska.** Engelska Grund, Engelska 1 och Engelska 2 går samtidigt.
 *   Alla läser engelska och ingen mer än en kurs (arbetslaget, okt 2026).
 *
 * Någon enstaka läser både Matte 1 och Matte 2, så mattesvaret är en lista.
 * Det är den enda kombinationen som förekommer: Ma Grund och Ma 1 går
 * samtidigt, och Ma Grund + Ma 2 har arbetslaget spärrat. En tom lista betyder
 * "läser ingen matte".
 *
 * Allt annat — lunch, paus, Onsdagsklubben, och varje pass som läggs till
 * senare — visas för alla. Ett okänt pass får aldrig försvinna av misstag;
 * hellre ett pass för mycket än att någon missar något gemensamt.
 *
 * Titlarna matchas tolerant: skiftläge och extra mellanslag spelar ingen roll
 * ("Ma  Grund" förekom i v. 40), och "Ma2 (tillval)", "Ma 2" och "Matte 2"
 * räknas som samma kurs. Engelskan skrivs "Engelska 1" eller "Eng 1".
 */

export type TemaClass = 'grund' | 'oliv' | 'rosa';
export type MathCourse = 'grund' | '1' | '2';
/** Ett svarsalternativ i dialogen. "ingen" är den tomma kurslistan. */
export type MathOption = MathCourse | 'ingen';

export type EnglishCourse = 'grund' | '1' | '2';

export type ParticipantChoice = {
  tema: TemaClass;
  /** Kurserna deltagaren läser. Tom = läser ingen matte. */
  math: MathCourse[];
  /**
   * `null` i ett val som sparades innan engelskan fanns i dialogen. Då visas
   * alla engelskpass, tills deltagaren svarar — dialogen kräver ett svar.
   */
  english: EnglishCourse | null;
};

export const TEMA_OPTIONS: { value: TemaClass; label: string }[] = [
  { value: 'grund', label: 'Grund' },
  { value: 'rosa', label: 'Rosa' },
  { value: 'oliv', label: 'Oliv' },
];

export const MATH_OPTIONS: { value: MathOption; label: string }[] = [
  { value: 'grund', label: 'Matte Grund' },
  { value: '1', label: 'Matte 1' },
  { value: '2', label: 'Matte 2' },
  { value: 'ingen', label: 'Läser ingen matte' },
];

export const ENGLISH_OPTIONS: { value: EnglishCourse; label: string }[] = [
  { value: 'grund', label: 'Engelska Grund' },
  { value: '1', label: 'Engelska 1' },
  { value: '2', label: 'Engelska 2' },
];

type PassKind =
  | { kind: 'tema'; tema: TemaClass }
  | { kind: 'math'; course: MathCourse }
  | { kind: 'english'; course: EnglishCourse }
  | { kind: 'studieverkstad' }
  | { kind: 'common' };

const normalize = (title: string) =>
  title.toLocaleLowerCase('sv').replace(/\s+/g, ' ').trim();

const TEMA_PATTERN = /^tema (grund|oliv|rosa)\b/;
const MATH_PATTERN = /^(?:ma|matte|matematik) ?(grund|1|2)\b/;
const ENGLISH_PATTERN = /^(?:engelska|eng) ?(grund|1|2)\b/;
const STUDIEVERKSTAD_PATTERN = /^studieverkstad\b/;

export const classifyPass = (title: string): PassKind => {
  const text = normalize(title ?? '');

  const tema = text.match(TEMA_PATTERN);
  if (tema) return { kind: 'tema', tema: tema[1] as TemaClass };

  const math = text.match(MATH_PATTERN);
  if (math) return { kind: 'math', course: math[1] as MathCourse };

  const english = text.match(ENGLISH_PATTERN);
  if (english) return { kind: 'english', course: english[1] as EnglishCourse };

  if (STUDIEVERKSTAD_PATTERN.test(text)) return { kind: 'studieverkstad' };

  return { kind: 'common' };
};

/**
 * Passen deltagaren ska se, i ursprunglig ordning.
 *
 * Studieverkstaden avgörs av vad som går samtidigt, inte av en tabell över
 * tider: den döljs bara för den vars egen matte- eller engelskkurs pågår
 * parallellt. Då blir
 * torsdagens ensamma studieverkstad synlig för alla, och en studieverkstad som
 * flyttas nästa vecka följer med utan att något behöver ändras här.
 */
export const filterForParticipant = (
  entries: ScheduledEntry[],
  choice: ParticipantChoice
): ScheduledEntry[] => {
  const kinds = new Map(entries.map(entry => [entry.instanceId, classifyPass(entry.title)]));
  const isOwnCourse = (kind: PassKind) =>
    (kind.kind === 'math' && choice.math.includes(kind.course))
    || (kind.kind === 'english' && kind.course === choice.english);

  return entries.filter(entry => {
    const kind = kinds.get(entry.instanceId)!;
    switch (kind.kind) {
      case 'common':
        return true;
      case 'tema':
        return kind.tema === choice.tema;
      case 'math':
        return choice.math.includes(kind.course);
      case 'english':
        return choice.english === null || kind.course === choice.english;
      case 'studieverkstad': {
        const ownCourseAtSameTime = entries.some(other => {
          return isOwnCourse(kinds.get(other.instanceId)!)
            && other.day === entry.day
            && checkOverlap(entry.startTime, entry.endTime, other.startTime, other.endTime);
        });
        return !ownCourseAtSameTime;
      }
    }
  });
};

const COURSE_ORDER: MathCourse[] = ['grund', '1', '2'];
const sortCourses = (courses: MathCourse[]) =>
  COURSE_ORDER.filter(course => courses.includes(course));

/**
 * Kurspar som får läsas tillsammans. Allt som inte står här byter av varandra.
 * Ma Grund och Ma 1 går samtidigt; Ma Grund + Ma 2 förekommer inte enligt
 * arbetslaget, så den kombinationen går inte heller att välja.
 */
const COMBINABLE: [MathCourse, MathCourse][] = [['1', '2']];

const canCombine = (a: MathCourse, b: MathCourse) =>
  COMBINABLE.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

/**
 * Nästa mattesvar när man trycker på ett alternativ i dialogen.
 *
 * - "Läser ingen matte" ersätter allt.
 * - En kurs som redan är vald väljs bort.
 * - Matte 1 och Matte 2 kan väljas tillsammans; alla andra kurser byter av
 *   varandra (se `COMBINABLE`).
 *
 * `null` betyder att frågan inte är besvarad än.
 */
export const toggleMathOption = (
  current: MathCourse[] | null,
  option: MathOption
): MathCourse[] | null => {
  if (option === 'ingen') return [];

  const selected = current ?? [];
  if (selected.includes(option)) {
    const remaining = selected.filter(course => course !== option);
    // Att välja bort sin enda kurs betyder inte "läser ingen matte" — frågan
    // blir obesvarad igen, så att man måste ta ställning.
    return remaining.length > 0 ? remaining : null;
  }

  const kept = selected.filter(course => canCombine(course, option));
  return sortCourses([...kept, option]);
};

/** Är alternativet markerat, givet mattesvaret? */
export const isMathOptionSelected = (current: MathCourse[] | null, option: MathOption) =>
  current !== null && (option === 'ingen' ? current.length === 0 : current.includes(option));

/**
 * "Tema Oliv · Matte 1 + Matte 2 · Engelska 1" — för raden som talar om vad
 * som visas. Ett äldre val utan engelska säger det, så att man ser varför alla
 * engelskpass står kvar.
 */
export const describeChoice = (choice: ParticipantChoice) => {
  const tema = TEMA_OPTIONS.find(option => option.value === choice.tema)?.label ?? choice.tema;
  const math = choice.math.length === 0
    ? 'Läser ingen matte'
    : choice.math
      .map(course => MATH_OPTIONS.find(option => option.value === course)?.label ?? course)
      .join(' + ');
  const english = choice.english === null
    ? 'Engelska: inte vald'
    : ENGLISH_OPTIONS.find(option => option.value === choice.english)?.label ?? choice.english;
  return `Tema ${tema} · ${math} · ${english}`;
};

/**
 * Tvättar ett sparat val. Webbläsarens lagring kan innehålla vad som helst —
 * och val sparade före flerval har en enda sträng i `math` ("1", "ingen").
 * Val sparade innan engelskan fanns saknar `english`; de behåller tema och
 * matte och får `english: null`, så att ingen tappar sitt val.
 */
export const sanitizeChoice = (input: unknown): ParticipantChoice | null => {
  if (!input || typeof input !== 'object') return null;
  const { tema, math, english } = input as Record<string, unknown>;
  if (!TEMA_OPTIONS.some(option => option.value === tema)) return null;

  const rawCourses = typeof math === 'string'
    ? (math === 'ingen' ? [] : [math])
    : Array.isArray(math) ? math : null;
  if (rawCourses === null) return null;
  if (!rawCourses.every(course => COURSE_ORDER.includes(course as MathCourse))) return null;

  const courses = sortCourses(rawCourses as MathCourse[]);
  // En kombination som inte går att välja i dialogen kan inte stämma; hellre
  // fråga om än gissa vilken av kurserna som gäller.
  const combinable = courses.every((a, i) => courses.slice(i + 1).every(b => canCombine(a, b)));
  if (!combinable) return null;

  const englishCourse = ENGLISH_OPTIONS.find(option => option.value === english)?.value ?? null;

  return { tema: tema as TemaClass, math: courses, english: englishCourse };
};
