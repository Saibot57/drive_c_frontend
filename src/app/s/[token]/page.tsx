import type { Metadata } from 'next';
import PublicScheduleView from '@/components/schedule/public/PublicScheduleView';

/**
 * Publik schemasida. Ligger med flit utanför `(full-width)` och utan
 * `ProtectedRoute` — den besöks av deltagare utan konto. Tokenen i adressen
 * är hela behörigheten, så sidan ska varken indexeras eller läcka adressen
 * som Referer när någon klickar vidare på en uppgiftslänk.
 */
export const metadata: Metadata = {
  title: 'Schema',
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
      <PublicScheduleView token={params.token} listOnMobile={searchParams.vy === 'lista'} />
    </div>
  );
}
