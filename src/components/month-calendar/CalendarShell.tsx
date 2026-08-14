'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import '@/styles/schedule-theme.css';
import '@/styles/month-calendar.css';

import type { HighlightColor } from '@/services/monthCalendarService';
import useCalendarData from '@/hooks/useCalendarData';
import {
  fromLocalDateKey,
  shiftMonth,
  todayKey as computeTodayKey,
  type DateKey,
} from '@/utils/calendarDates';
import CalendarToolbar from './CalendarToolbar';
import DayNotesSidebar from './DayNotesSidebar';
import MonthGrid from './MonthGrid';
import type { HighlighterMode } from './types';

export default function CalendarShell() {
  // Dagens datum beräknas en gång per montering. Att räkna om det vid varje
  // rendering skulle byta "idag"-markeringen mitt i en session vid midnatt,
  // vilket är mer förvirrande än att den ligger kvar tills sidan laddas om.
  const today = useMemo(() => computeTodayKey(), []);

  const [selected, setSelected] = useState<DateKey>(today);
  const [{ year, month }, setMonthState] = useState(() => {
    const d = fromLocalDateKey(today);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [mode, setMode] = useState<HighlighterMode>('off');
  const [activeColor, setActiveColor] = useState<HighlightColor>('yellow');
  const [mobileSidebar, setMobileSidebar] = useState(false);

  const {
    cells,
    getDay,
    loading,
    loadError,
    bandCount,
    changeBandCount,
    setQuickText,
    setNoteDocument,
    setHighlights,
    flushAll,
    saveStatus,
    saveError,
    retrySave,
  } = useCalendarData(year, month);

  // ─── Navigation ────────────────────────────────────────────────────────────

  const goMonth = useCallback((delta: number) => {
    // Väntande text spolas innan månaden byts, så inget ligger osparat kvar.
    void flushAll();
    setMonthState((s) => shiftMonth(s.year, s.month, delta));
  }, [flushAll]);

  const goToday = useCallback(() => {
    void flushAll();
    const d = fromLocalDateKey(today);
    setMonthState({ year: d.getFullYear(), month: d.getMonth() });
    setSelected(today);
  }, [flushAll, today]);

  const selectDay = useCallback((key: DateKey) => {
    // Spola den föregående dagens väntande ändringar innan bytet — annars kan
    // en debouncad anteckning skrivas efter att editorn bytt dag.
    void flushAll();
    setSelected(key);
    setMobileSidebar(true);
  }, [flushAll]);

  // ─── Highlighter ───────────────────────────────────────────────────────────

  const toggleHighlighter = useCallback(() => {
    setMode((m) => (m === 'off' ? 'paint' : 'off'));
  }, []);

  const onBandClick = useCallback((key: DateKey, band: number) => {
    if (mode === 'off') return;
    const current = getDay(key).highlights;
    const next =
      mode === 'erase'
        ? current.filter((h) => h.band !== band)
        : [...current.filter((h) => h.band !== band), { band, color: activeColor }]
            .sort((a, b) => a.band - b.band);
    void setHighlights(key, next);
  }, [mode, activeColor, getDay, setHighlights]);

  // Escape lämnar målarläget, oavsett var fokus ligger i kalendern.
  useEffect(() => {
    if (mode === 'off') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMode('off');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode]);

  const selectedData = getDay(selected);

  return (
    <div
      className={[
        'mc-root',
        'sp-root',
        'mc-shell',
        '-mx-8 -mt-8',
        mode === 'paint' ? 'mc-root--painting' : '',
        mode === 'erase' ? 'mc-root--painting mc-root--erasing' : '',
      ].filter(Boolean).join(' ')}
    >
      <CalendarToolbar
        year={year}
        month={month}
        mode={mode}
        activeColor={activeColor}
        bandCount={bandCount}
        saveStatus={saveStatus}
        onPrev={() => goMonth(-1)}
        onNext={() => goMonth(1)}
        onToday={goToday}
        onToggleHighlighter={toggleHighlighter}
        onColor={(c) => {
          setActiveColor(c);
          setMode('paint');
        }}
        onErase={() => setMode((m) => (m === 'erase' ? 'paint' : 'erase'))}
        onBandCount={changeBandCount}
      />

      <div className="mc-body">
        <main className="mc-main">
          {loadError && (
            <div role="alert" className="mb-2 rounded border-2 border-black bg-red-50 px-3 py-1.5 text-sm">
              {loadError}
            </div>
          )}
          {loading && !loadError && (
            <p className="px-1 pb-1 text-xs text-gray-500" aria-live="polite">
              Hämtar…
            </p>
          )}
          <MonthGrid
            cells={cells}
            getDay={getDay}
            bandCount={bandCount}
            todayKey={today}
            selected={selected}
            mode={mode}
            onSelect={selectDay}
            onQuickText={setQuickText}
            onBandClick={onBandClick}
          />
        </main>

        <DayNotesSidebar
          dateKey={selected}
          data={selectedData}
          isToday={selected === today}
          open={mobileSidebar}
          onClose={() => setMobileSidebar(false)}
          onNoteChange={setNoteDocument}
          saveError={saveError}
          onRetry={retrySave}
        />
      </div>
    </div>
  );
}
