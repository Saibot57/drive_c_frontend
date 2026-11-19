'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Copy, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { chip } from '@/components/narvaro/chip';
import type { ScheduleWeeks } from '@/hooks/useNarvaroSchedule';
import { downloadBlob } from '@/utils/download';
import type { NarvaroData } from '@/utils/narvaroDocs';
import { exportClasses, exportFileName, exportHtml, exportText, exportWeeks } from '@/utils/narvaroExport';

/**
 * Exportera noteringar: välj veckor och klasser, och kopiera texten eller
 * ladda ner den som .txt. Texten byggs i `utils/narvaroExport.ts`; se
 * docs/plans/narvaro-export.md.
 */

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: Pick<NarvaroData, 'tables' | 'notes' | 'groups' | 'passNames' | 'stamps'>;
  schedules: ScheduleWeeks;
  ensureWeek: (week: string) => void;
  myName: string;
  resolveRoom: (title: string, room?: string) => string;
  /** Veckan och klasserna som visas på sidan, förvalda när dialogen öppnas. */
  shownWeek: string;
  shownClasses: readonly string[];
  /** `html` är samma text med formatering, för Google Docs. */
  onCopy: (text: string, html: string) => void;
};

const weekNumber = (weekKey: string) => weekKey.slice(-2).replace(/^0/, '');
const LABEL = 'font-mono text-2xs font-bold uppercase tracking-widest text-ui-muted';

export function NarvaroExportDialog({
  open, onOpenChange, data, schedules, ensureWeek, myName, resolveRoom, shownWeek, shownClasses, onCopy,
}: Props) {
  const allWeeks = useMemo(() => exportWeeks(data.notes), [data.notes]);
  const [weeks, setWeeks] = useState<string[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const classChoices = useMemo(() => exportClasses(data.tables, weeks), [data.tables, weeks]);

  // Varje gång dialogen öppnas: veckan som visas, eller den senaste med noteringar.
  useEffect(() => {
    if (!open) return;
    const start = allWeeks.some(w => w.week === shownWeek) ? shownWeek : allWeeks[0]?.week;
    setWeeks(start ? [start] : []);
    setClasses([...shownClasses]);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open) weeks.forEach(ensureWeek);
  }, [open, weeks, ensureWeek]);

  const picked = classes.filter(k => classChoices.includes(k));
  const loading = weeks.some(w => schedules[w] === undefined);
  const exported = useMemo(() => {
    if (loading) return { text: '', html: '' };
    const input = {
      weeks,
      classes: picked,
      tables: data.tables,
      notes: data.notes,
      groups: data.groups,
      passNames: data.passNames,
      stamps: data.stamps,
      schedules: Object.fromEntries(weeks.map(w => [w, schedules[w]?.entries ?? null])),
      myName,
      resolveRoom,
      today: new Date(),
    };
    return { text: exportText(input), html: exportHtml(input) };
    // `picked` är en ny lista varje rendering; nyckeln står för den.
  }, [loading, weeks, picked.join('+'), data, schedules, myName, resolveRoom]); // eslint-disable-line react-hooks/exhaustive-deps
  const { text, html } = exported;

  const toggle = (list: string[], value: string) =>
    (list.includes(value) ? list.filter(v => v !== value) : [...list, value]);
  const withoutSchedule = weeks.filter(w => schedules[w] === null).sort();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Exportera noteringar</DialogTitle>
          <DialogDescription>
            Ett stycke per pass med datum, schemats titel och innehåll. Kopiera ger rubriker och fetstil i Google Dokument. Texten har elevernas namn i klartext, så lägg den bara där den får finnas.
          </DialogDescription>
        </DialogHeader>

        {allWeeks.length === 0 ? (
          <p className="text-sm text-ui-muted">Det finns inga noteringar att exportera än.</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className={LABEL}>Veckor</span>
                <button type="button" className="text-xs font-semibold underline" onClick={() => setWeeks(allWeeks.map(w => w.week))}>Alla</button>
                <button type="button" className="text-xs font-semibold underline" onClick={() => setWeeks([])}>Ingen</button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {allWeeks.map(w => (
                  <button key={w.week} type="button" aria-pressed={weeks.includes(w.week)} className={chip(weeks.includes(w.week))} onClick={() => setWeeks(toggle(weeks, w.week))}>
                    v. {weekNumber(w.week)}
                    <small className="font-mono text-2xs opacity-70">{w.sessions} pass</small>
                  </button>
                ))}
              </div>
            </div>

            {classChoices.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className={LABEL}>Klasser</span>
                <div className="flex flex-wrap gap-1.5">
                  {classChoices.map(k => (
                    <button key={k} type="button" aria-pressed={classes.includes(k)} className={chip(classes.includes(k))} onClick={() => setClasses(toggle(classes, k))}>
                      {k || 'Utan klass'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {withoutSchedule.length > 0 && (
              <p className="text-sm text-ui-muted">
                Inget schema hittades för v. {withoutSchedule.map(weekNumber).join(', ')}. De passen exporteras utan titel och innehåll.
              </p>
            )}

            {loading ? (
              <p className="flex items-center gap-2 text-sm text-ui-muted"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Hämtar schemat…</p>
            ) : text ? (
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-ui-sm border border-ui-line bg-ui-surface-2 p-2.5 font-mono text-xs" aria-label="Förhandsvisning">
                {text}
              </pre>
            ) : (
              <p className="text-sm text-ui-muted">Inga noteringar för det valda. Välj fler veckor eller klasser.</p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button variant="neutral" className="sp-btn" disabled={!text} onClick={() => onCopy(text, html)} title="Klistras in i Google Dokument med rubriker och fetstil">
                <Copy /> Kopiera
              </Button>
              <Button
                variant="neutral"
                className="sp-btn"
                disabled={!text}
                onClick={() => downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), exportFileName(weeks))}
              >
                <Download /> Ladda ner .txt
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
