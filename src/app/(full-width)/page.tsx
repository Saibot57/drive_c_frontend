'use client';
import ProtectedRoute from '@/components/ProtectedRoute';
import NewSchedulePlanner from '@/components/schedule/NewSchedulePlanner';

/**
 * Schemaplaneraren är appens startsida.
 *
 * Samma komponent renderas fortfarande på `/features/schedule`, som behålls så
 * att gamla bokmärken inte dör. Planeraren är sökvägsoberoende — den enda
 * `window.location`-läsningen i NewSchedulePlanner är en dev-only debugflagga —
 * så att montera den på två routes är ofarligt.
 *
 * Biblioteket, som låg här tidigare, finns nu på `/features/bibliotek`.
 */
export default function Home() {
  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <NewSchedulePlanner />
      </div>
    </ProtectedRoute>
  );
}
