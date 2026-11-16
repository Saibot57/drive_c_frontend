'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/**
 * Veckans ark i Närvarorutor: klassernas ark för veckan och rutan att
 * klistra in i. En dialog bakom knappen i sidhuvudet, eller ett kort på
 * sidan när inget ark finns än (`inline`). Tillståndet för inklistringen
 * ägs av Narvaro; se docs/plans/narvaro-veckokarta.md, avsnitt 7.
 */

export type SheetRow = {
  klass: string;
  label: string;
  /** Arket är den här veckans. Annars en äldre veckas, som fortfarande används. */
  thisWeek: boolean;
  week: string;
  people: number;
  schools: number;
};

export type PasteMessage = { kind: 'ok' | 'error'; text: string } | null;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ett kort på sidan i stället för en dialog. */
  inline: boolean;
  weekNumber: string;
  rows: SheetRow[];
  onRemove: (klass: string) => void;
  pasteText: string;
  onPasteText: (text: string) => void;
  onPaste: (text: string, html: string) => void;
  message: PasteMessage;
  /** Frågan om klass, eller "Fel klass?" efter en inklistring. */
  picker?: React.ReactNode;
  /** De första raderna av det som inte gick att läsa. */
  raw: string;
  onCopyRaw: () => void;
  onShowExample: () => void;
};

const weekNumberOf = (weekKey: string) => weekKey.slice(-2).replace(/^0/, '');

function Panel({
  weekNumber, rows, onRemove, pasteText, onPasteText, onPaste, message, picker, raw, onCopyRaw, onShowExample, inline,
}: Omit<Props, 'open' | 'onOpenChange'>) {
  const [armed, setArmed] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-3">
      {rows.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-2xs font-bold uppercase tracking-widest text-ui-muted">Klasser</span>
          <ul className="flex flex-col gap-1.5">
            {rows.map(r => (
              <li
                key={r.klass}
                className={cn(
                  'grid items-center gap-x-3 gap-y-1 rounded-ui-sm border-frame border-ui-line px-3 py-2 text-sm sm:grid-cols-[minmax(0,8rem)_minmax(0,1fr)_auto]',
                  r.thisWeek ? 'bg-ui-paper' : 'bg-ui-mark-yellow text-ui-mark-fg',
                )}
              >
                <b>{r.label}</b>
                <span>
                  {r.thisWeek
                    ? `✓ Vecka ${weekNumber} · ${r.people} deltagare${r.schools > 1 ? ` från ${r.schools} skolor` : ''}`
                    : `Från vecka ${weekNumberOf(r.week)}. Klistra in veckans ark när du har det.`}
                </span>
                {r.thisWeek ? (
                  <button
                    type="button"
                    className="justify-self-start text-xs underline sm:justify-self-end"
                    onClick={() => {
                      if (armed !== r.klass) { setArmed(r.klass); return; }
                      onRemove(r.klass);
                      setArmed(null);
                    }}
                  >
                    {armed === r.klass ? 'Säker? Tryck igen' : 'Ta bort'}
                  </button>
                ) : <span />}
              </li>
            ))}
          </ul>
          <p className="text-xs text-ui-muted">Ta bort gäller bara veckans ark. Noteringarna finns kvar.</p>
        </div>
      )}

      {inline && (
        <ol className="ml-5 list-decimal text-sm">
          <li>Markera hela tabellen i klassens ark, med dag- och tidsraderna överst (till exempel A1:Q34).</li>
          <li>Kopiera med Ctrl+C, eller Cmd+C på Mac.</li>
          <li>Klicka i rutan nedan och klistra in. Gör likadant för varje klass.</li>
        </ol>
      )}
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Klistra in en klass
        <textarea
          id="narvaro-paste"
          className="sp-input min-h-[80px] w-full rounded-ui-sm bg-ui-surface-2 p-2.5 font-mono text-xs font-normal"
          placeholder="Klistra in här, eller var som helst på sidan"
          value={pasteText}
          onChange={e => onPasteText(e.target.value)}
          onPaste={e => {
            const html = e.clipboardData.getData('text/html');
            const text = e.clipboardData.getData('text/plain');
            if (html || text) { e.preventDefault(); onPaste(text, html); }
          }}
        />
      </label>
      {!inline && (
        <p className="text-xs text-ui-muted">
          Markera hela tabellen i klassens Google-ark, med dag- och tidsraderna, kopiera och klistra in. Klassen känns igen på namnen.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button className="sp-btn" onClick={() => onPaste(pasteText, '')}>Läs in</Button>
        <Button variant="neutral" className="sp-btn" onClick={onShowExample}>Visa exemplet</Button>
        {message && (
          <span
            role="status"
            className={cn(
              'rounded-ui-sm border border-ui-line px-2 py-0.5 text-sm font-semibold text-ui-mark-fg',
              message.kind === 'ok' ? 'bg-ui-mark-green' : 'bg-ui-mark-pink',
            )}
          >
            {message.text}
          </span>
        )}
      </div>
      {picker}
      {raw && (
        <details className="flex flex-col gap-1.5">
          <summary className="cursor-pointer text-sm font-semibold">Så här såg det inklistrade ut (de första raderna)</summary>
          <textarea readOnly rows={8} value={raw} className="sp-input my-1.5 w-full whitespace-pre rounded-ui-sm bg-ui-surface-2 p-2 font-mono text-2xs" />
          <Button variant="neutral" size="sm" className="sp-btn self-start" onClick={onCopyRaw}>Kopiera</Button>
        </details>
      )}
      <p className="text-xs text-ui-muted">
        Allt krypteras här innan det sparas, och servern kan inte läsa något. Arket sparas för vecka {weekNumber}.
        Klistra in på nytt när arket har uppdaterats.
      </p>
    </div>
  );
}

export function NarvaroSheetsDialog({ open, onOpenChange, ...panel }: Props) {
  if (panel.inline) {
    return (
      <section className="sp-card flex flex-col gap-3 p-4" aria-label="Klistra in">
        <h2 className="text-lg font-bold">Klistra in en klass från Google Kalkylark</h2>
        <Panel {...panel} />
      </section>
    );
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Veckans ark · vecka {panel.weekNumber}</DialogTitle>
          <DialogDescription className="sr-only">Klassernas ark för veckan och rutan att klistra in i.</DialogDescription>
        </DialogHeader>
        <Panel {...panel} />
      </DialogContent>
    </Dialog>
  );
}
