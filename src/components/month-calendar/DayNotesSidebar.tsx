'use client';

import { X } from 'lucide-react';

import type { CalendarDayData, NoteDocument } from '@/services/monthCalendarService';
import { formatSwedishDate, getIsoWeek, type DateKey } from '@/utils/calendarDates';
import DayNotesEditor from './DayNotesEditor';

interface Props {
  dateKey: DateKey;
  data: CalendarDayData;
  isToday: boolean;
  /**
   * Styr bara mobilens helskärmspanel. På desktop är sidebaren en kolumn som
   * alltid syns, och flaggan har ingen effekt — se `.mc-sidebar--closed`, som
   * bara gäller under mobilbrytpunkten.
   */
  open: boolean;
  onClose: () => void;
  onNoteChange: (key: DateKey, doc: NoteDocument) => void;
  saveError: string | null;
  onRetry: () => void;
}

export default function DayNotesSidebar({
  dateKey,
  data,
  isToday,
  open,
  onClose,
  onNoteChange,
  saveError,
  onRetry,
}: Props) {
  return (
    <aside
      className={`mc-sidebar${open ? '' : ' mc-sidebar--closed'}`}
      aria-label="Dagsanteckning"
    >
      <div className="mc-sidebar-head">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="mc-sidebar-date">{formatSwedishDate(dateKey)}</h2>
            <p className="mc-sidebar-week">
              Vecka {getIsoWeek(dateKey)}
              {isToday && ' · Idag'}
            </p>
          </div>
          <button
            type="button"
            className="mc-btn mc-btn--icon mc-sidebar-close"
            onClick={onClose}
            aria-label="Stäng anteckning"
          >
            <X size={16} />
          </button>
        </div>

        {saveError && (
          <div
            role="alert"
            className="mt-2 flex items-center justify-between gap-2 rounded border-2 border-black bg-red-50 px-2 py-1 text-xs"
          >
            <span>{saveError}</span>
            <button type="button" className="mc-btn" onClick={onRetry}>
              Försök igen
            </button>
          </div>
        )}
      </div>

      {/*
        `key` gör att editorn monteras om vid dagbyte. Det garanterar att inget
        kan läcka mellan två dagars dokument — och kostar ingenting, eftersom
        bara en dag är öppen åt gången.
      */}
      <DayNotesEditor
        key={dateKey}
        dateKey={dateKey}
        doc={data.note_document}
        onChange={(doc) => onNoteChange(dateKey, doc)}
      />
    </aside>
  );
}
