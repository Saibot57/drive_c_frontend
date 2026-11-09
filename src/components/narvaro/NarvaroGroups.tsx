'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Copy, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { PersonNote, Stamp } from '@/utils/narvaro';
import { findExact, uniquePrefixMatch } from '@/utils/autocomplete';
import { StampTag } from '@/components/narvaro/stampStyle';

type Target = number | 'pool';

type Props = {
  view: { groups: string[][]; pool: string[] };
  people: Record<string, PersonNote>;
  stamps: readonly Stamp[];
  onMove: (name: string, target: Target) => void;
  onAddGroup: () => void;
  onDeleteGroup: (index: number) => void;
  onCopy: () => void;
};

type Drag = {
  name: string;
  el: HTMLElement;
  id: number;
  x: number;
  y: number;
  lastX: number;
  lastY: number;
  touch: boolean;
  on: boolean;
  timer: ReturnType<typeof setTimeout> | null;
};

/**
 * Fält i ett gruppkort där ett namn ur "Inte indelade" skrivs in. När minst
 * tre tecken bara kan vara ett namn fylls resten i (som SmartTextInput i
 * schemaplaneraren); Enter eller + lägger personen i gruppen.
 */
function GroupNameInput({ group, pool, onAdd }: { group: number; pool: readonly string[]; onAdd: (name: string) => void }) {
  const [value, setValue] = useState('');
  const [miss, setMiss] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!miss) return;
    const t = setTimeout(() => setMiss(false), 700);
    return () => clearTimeout(t);
  }, [miss]);

  const onChange = (next: string) => {
    setMiss(false);
    // Fyll bara i när användaren skriver till tecken, inte när hen raderar.
    const match = next.length > value.length ? uniquePrefixMatch(next, pool) : null;
    setValue(match ?? next);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = findExact(value, pool);
    if (!name) { setMiss(true); input.current?.focus(); return; }
    setValue('');
    onAdd(name);
    input.current?.focus();
  };

  return (
    <form onSubmit={submit} className="flex items-center gap-1 border-t-2 border-ui-hair p-1.5">
      <input
        ref={input}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Lägg till namn…"
        aria-label={`Lägg till namn i grupp ${group + 1}`}
        aria-invalid={miss || undefined}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="enter"
        className={cn(
          'sp-input min-w-0 flex-1 rounded-ui-sm bg-ui-paper px-2 py-1 text-sm',
          miss && 'border-ui-danger outline outline-2 outline-ui-danger',
        )}
      />
      <button
        type="submit"
        className="rounded-ui-sm border-2 border-ui-line bg-ui-paper p-1 hover:bg-ui-surface-3"
        aria-label={`Lägg in i grupp ${group + 1}`}
        title="Lägg in i gruppen"
      >
        <Plus size={14} />
      </button>
    </form>
  );
}

const targetOf = (value: string | undefined): Target | null =>
  value === undefined ? null : value === 'pool' ? 'pool' : Number(value);

/**
 * Grupperna, med "Inte indelade" överst. Ett namn flyttas på tre sätt: dra
 * det (med finger efter ett kort tryck och håll, så att sidan fortfarande går
 * att skrolla), tryck på det och sedan på en grupp, eller markera det med
 * tangentbordet och tryck på gruppens siffra (0 tar ur det).
 *
 * Draget bygger på pekhändelser i stället för HTML:s drag and drop, som inte
 * fungerar med finger i alla webbläsare.
 */
export function NarvaroGroups({ view, people, stamps, onMove, onAddGroup, onDeleteGroup, onCopy }: Props) {
  const [picked, setPicked] = useState<string | null>(null);
  const [over, setOver] = useState<Target | null>(null);
  const drag = useRef<Drag | null>(null);
  const ghost = useRef<HTMLDivElement>(null);
  const [ghostName, setGhostName] = useState<string | null>(null);
  const move = useRef(onMove);
  move.current = onMove;

  const all = [...view.groups.flat(), ...view.pool];
  const activePick = picked && all.includes(picked) ? picked : null;

  useEffect(() => {
    const dropAt = (x: number, y: number): Target | null => {
      const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-gdrop]');
      return targetOf(el?.dataset.gdrop);
    };
    const place = (x: number, y: number) => {
      if (ghost.current) ghost.current.style.transform = `translate(${x + 10}px, ${y - 18}px)`;
      setOver(dropAt(x, y));
    };
    const start = (d: Drag) => {
      d.on = true;
      setGhostName(d.name);
      d.el.style.opacity = '0.35';
      // Spöket ritas i nästa rendering; placera det då.
      requestAnimationFrame(() => place(d.lastX, d.lastY));
    };
    const end = () => {
      const d = drag.current;
      if (!d) return;
      if (d.timer) clearTimeout(d.timer);
      d.el.style.opacity = '';
      drag.current = null;
      setGhostName(null);
      setOver(null);
    };

    const onDown = (e: PointerEvent) => {
      const li = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-gname]');
      if (!li || e.button > 0) return;
      end();
      const d: Drag = {
        name: li.dataset.gname ?? '', el: li, id: e.pointerId, x: e.clientX, y: e.clientY,
        lastX: e.clientX, lastY: e.clientY, touch: e.pointerType !== 'mouse', on: false, timer: null,
      };
      drag.current = d;
      if (d.touch) {
        d.timer = setTimeout(() => {
          if (drag.current === d && !d.on) {
            start(d);
            try { navigator.vibrate?.(15); } catch { /* finns inte överallt */ }
          }
        }, 260);
      } else {
        e.preventDefault();
      }
    };
    const onMovePointer = (e: PointerEvent) => {
      const d = drag.current;
      if (!d || e.pointerId !== d.id) return;
      d.lastX = e.clientX;
      d.lastY = e.clientY;
      if (!d.on) {
        if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < (d.touch ? 10 : 5)) return;
        // Ett finger som rör sig innan det hållits stilla skrollar sidan.
        if (d.touch) { end(); return; }
        start(d);
        return;
      }
      place(e.clientX, e.clientY);
    };
    const onUp = (e: PointerEvent) => {
      const d = drag.current;
      if (!d || e.pointerId !== d.id) return;
      if (d.on) {
        const t = dropAt(e.clientX, e.clientY);
        end();
        if (t !== null) { setPicked(null); move.current(d.name, t); }
        return;
      }
      end();
      setPicked(p => (p === d.name ? null : d.name));
    };
    // Utan det här skrollar sidan medan ett namn dras med finger.
    const onTouchMove = (e: TouchEvent) => { if (drag.current?.on && e.cancelable) e.preventDefault(); };
    const onContextMenu = (e: MouseEvent) => {
      if (drag.current && (e.target as HTMLElement | null)?.closest('[data-gname]')) e.preventDefault();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { end(); setPicked(null); } };

    document.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMovePointer);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', end);
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('keydown', onKey);
    return () => {
      end();
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMovePointer);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', end);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const pickTo = (target: Target) => {
    if (!activePick) return;
    setPicked(null);
    onMove(activePick, target);
  };

  const onNameKey = (e: React.KeyboardEvent<HTMLLIElement>, name: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setPicked(p => (p === name ? null : name));
    } else if (/^[0-9]$/.test(e.key)) {
      const n = Number(e.key);
      if (n !== 0 && !view.groups[n - 1]) return;
      e.preventDefault();
      setPicked(null);
      onMove(name, n === 0 ? 'pool' : n - 1);
      // Namnet ritas om i sin nya grupp; behåll fokus på det.
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>(`[data-gname="${CSS.escape(name)}"]`)?.focus());
    }
  };

  const nameItem = (name: string, chip: boolean) => (
    <li
      key={name}
      data-gname={name}
      tabIndex={0}
      onKeyDown={e => onNameKey(e, name)}
      className={cn(
        'flex cursor-grab select-none flex-wrap items-center gap-1.5 rounded-ui-sm border-2 px-1.5 py-0.5 text-sm [-webkit-touch-callout:none]',
        chip ? 'border-ui-line bg-ui-paper' : 'border-transparent hover:border-ui-hair',
        activePick === name && 'border-ui-line bg-ui-mark-yellow text-ui-mark-fg',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)]',
      )}
    >
      {name}
      {(people[name]?.tags ?? []).map(id => <StampTag key={id} stamp={stamps.find(s => s.id === id)} small />)}
    </li>
  );

  const card = (target: Target) => cn(
    'sp-card-sm min-w-0 overflow-hidden',
    activePick && 'cursor-pointer',
    over === target && 'outline-dashed outline-[3px] outline-offset-2 outline-[var(--ui-focus)]',
  );
  const onCardClick = (e: React.MouseEvent, target: Target) => {
    if ((e.target as HTMLElement).closest('[data-gname],button,form')) return;
    pickTo(target);
  };

  return (
    <section className="sp-card flex flex-col gap-3 p-4" aria-label="Grupper">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-bold">Grupper</h3>
        <div className="flex flex-wrap gap-2">
          <Button variant="neutral" size="sm" className="sp-btn" onClick={onAddGroup}><Plus /> Ny grupp</Button>
          <Button variant="neutral" size="sm" className="sp-btn" onClick={onCopy}><Copy /> Kopiera grupperna</Button>
        </div>
      </div>
      <p className="max-w-prose text-sm text-ui-muted">
        Dra ett namn till en annan grupp, eller tryck på namnet och sedan på gruppen. Med tangentbordet:
        markera namnet och tryck på gruppens siffra, eller 0 för att ta ur det. Du kan också skriva
        ett namn i gruppens fält: efter tre bokstäver fylls det i när bara ett namn passar.
      </p>

      <div data-gdrop="pool" className={card('pool')} onClick={e => onCardClick(e, 'pool')}>
        <h4 className="flex justify-between bg-ui-mark-grey px-3 py-1.5 font-bold text-ui-mark-fg">
          Inte indelade <span className="font-mono text-xs font-normal">{view.pool.length} st</span>
        </h4>
        <ul className="flex flex-wrap gap-1.5 p-2.5">
          {view.pool.length
            ? view.pool.map(n => nameItem(n, true))
            : <li className="text-sm italic text-ui-muted">Alla är indelade. Dra hit ett namn för att ta det ur en grupp.</li>}
        </ul>
      </div>

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]">
        {view.groups.map((group, i) => (
          <div key={i} data-gdrop={i} className={card(i)} onClick={e => onCardClick(e, i)}>
            <h4 className="flex items-center justify-between border-b-frame border-ui-line bg-ui-mark-green px-3 py-1.5 font-bold text-ui-mark-fg">
              Grupp {i + 1}
              <span className="flex items-center gap-2 font-mono text-xs font-normal">
                {group.length} st
                <button
                  type="button"
                  className="rounded-sm p-0.5 hover:bg-ui-paper"
                  onClick={() => onDeleteGroup(i)}
                  aria-label={`Ta bort grupp ${i + 1}`}
                  title="Ta bort gruppen. De som var i den blir inte indelade."
                >
                  <X size={14} />
                </button>
              </span>
            </h4>
            <ul className="flex flex-col gap-0.5 p-2">
              {group.length ? group.map(n => nameItem(n, false)) : <li className="px-1.5 text-sm italic text-ui-muted">Dra hit namn</li>}
            </ul>
            <GroupNameInput group={i} pool={view.pool} onAdd={name => onMove(name, i)} />
          </div>
        ))}
      </div>

      {ghostName && (
        <div
          ref={ghost}
          aria-hidden
          className="pointer-events-none fixed left-0 top-0 z-[1400] whitespace-nowrap rounded-ui-sm border-frame border-ui-line bg-ui-mark-yellow px-2.5 py-1 text-sm font-bold text-ui-mark-fg shadow-float"
        >
          {ghostName}
        </div>
      )}
    </section>
  );
}
