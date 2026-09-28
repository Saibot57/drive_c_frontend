import type { Metadata } from 'next';
import PublicScheduleView from '@/components/schedule/public/PublicScheduleView';

/**
 * Publik schemasida. Ligger med flit utanför `(full-width)` och utan
 * `ProtectedRoute` — den besöks av deltagare utan konto. Tokenen i adressen
 * är hela behörigheten, så sidan ska varken indexeras eller läcka adressen
 * som Referer när någon klickar vidare på en uppgiftslänk.
 */
/**
 * Titel och beskrivning är fasta med flit, inte veckans namn. Länken är
 * densamma varje vecka, och chattjänster sparar förhandsvisningen — en titel
 * som "v. 40" skulle stå kvar när länken delas inför v. 41.
 *
 * Ingen förhandsbild (Tobias val). Tjänsterna kan då ta en egen skärmdump.
 */
const TITLE = 'Veckans schema';
const DESCRIPTION = 'Allmän kurs · uppdateras automatiskt';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: 'FHSK Schema',
    type: 'website',
    locale: 'sv_SE',
  },
  twitter: { card: 'summary', title: TITLE, description: DESCRIPTION },
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

type PageProps = {
  params: { token: string };
  searchParams: { vy?: string | string[] };
};

export default function PublicSchedulePage({ params, searchParams }: PageProps) {
  return (
    // Rotlayouten har 2rem padding runt allt; på en telefon är det för mycket.
    <div className="-mx-8 -mt-8 px-3 pt-4 sm:px-8 sm:pt-6">
      {/* Dagslistan är mobilens standard sedan arbetslaget valde den.
          Dagsschemat i rutnätet ligger kvar bakom ?vy=dagsschema under
          provperioden; ?vy=lista från jämförelsen fungerar fortfarande. */}
      <PublicScheduleView
        token={params.token}
        listOnMobile={searchParams.vy !== 'dagsschema'}
      />
    </div>
  );
}
