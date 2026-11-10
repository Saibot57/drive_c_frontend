import { describe, expect, it } from 'vitest';
import type { MindmapContent } from '@/types/mindmap';
import { breakCoalescing, emptyHistory, MAX_MINDMAP_HISTORY, recordChange, redo, undo } from './mindmapHistory';

const snap = (label: string) => ({
  content: { root: { id: 'r', label, children: [] }, layout: 'right' } as MindmapContent,
  selectedId: 'r',
});

describe('mindmapHistory', () => {
  it('ångrar och gör om', () => {
    let history = recordChange(emptyHistory(), snap('a'), null);
    history = recordChange(history, snap('b'), null);
    const back = undo(history, snap('c'))!;
    expect(back.snapshot.content.root.label).toBe('b');
    const forward = redo(back.history, back.snapshot)!;
    expect(forward.snapshot.content.root.label).toBe('c');
    expect(undo(emptyHistory(), snap('x'))).toBeNull();
    expect(redo(emptyHistory(), snap('x'))).toBeNull();
  });

  it('slår ihop skrivande i samma nod till ett steg', () => {
    let history = recordChange(emptyHistory(), snap(''), 'label:r');
    history = recordChange(history, snap('H'), 'label:r');
    history = recordChange(history, snap('He'), 'label:r');
    expect(history.past).toHaveLength(1);
    expect(undo(history, snap('Hej'))!.snapshot.content.root.label).toBe('');
  });

  it('ger en ny post när skrivandet avbrutits', () => {
    let history = recordChange(emptyHistory(), snap(''), 'label:r');
    history = breakCoalescing(history);
    history = recordChange(history, snap('Hej'), 'label:r');
    expect(history.past).toHaveLength(2);
  });

  it('tömmer gör om-listan vid en ny ändring', () => {
    const history = recordChange(emptyHistory(), snap('a'), null);
    const back = undo(history, snap('b'))!;
    expect(recordChange(back.history, snap('a'), null).future).toEqual([]);
  });

  it('håller sig under taket', () => {
    let history = emptyHistory();
    for (let i = 0; i < MAX_MINDMAP_HISTORY + 10; i += 1) history = recordChange(history, snap(String(i)), null);
    expect(history.past).toHaveLength(MAX_MINDMAP_HISTORY);
    expect(history.past[0].content.root.label).toBe('10');
  });
});
