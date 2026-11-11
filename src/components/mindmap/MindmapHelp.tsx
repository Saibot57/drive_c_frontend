'use client';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MINDMAP_SHORTCUTS } from '@/utils/mindmap/mindmapKeys';

/** Sidans egna kortkommandon, utöver kortets lista. Fler kommer med planens steg. */
const PAGE_SHORTCUTS: { group: string; items: { keys: string; what: string }[] }[] = [
  {
    group: 'Sidan',
    items: [
      { keys: 'Ctrl+Shift+7', what: 'Gå till Mindmap' },
      { keys: 'Klick på markerad nod', what: 'Redigera noden' },
      { keys: 'Dra en nod', what: 'Flytta grenen till en annan nod' },
      { keys: 'Ctrl+hjul, Ctrl++ / Ctrl+-', what: 'Zooma in och ut' },
      { keys: 'Hjul, dra på tom yta', what: 'Panorera' },
      { keys: 'Dra med mittknappen', what: 'Panorera, också på en nod' },
      { keys: 'Ctrl+0', what: 'Passa in hela kartan' },
      { keys: 'Ctrl+.', what: 'Centrera på den markerade noden' },
      { keys: 'Klick i minikartan', what: 'Flytta vyn dit' },
      { keys: 'Alt+N', what: 'Anteckning på noden (Esc går tillbaka till kartan)' },
      { keys: 'Alt+L', what: 'Länk på noden' },
      { keys: 'Alt+I', what: 'Bild i noden' },
      { keys: 'Alt+Shift+1–8', what: 'Ikon (Alt+Shift+9 tar bort)' },
      { keys: 'Ctrl+C / X / V', what: 'Grenen följer med hel: anteckning, länk, bild, ikon och färg' },
    ],
  },
];

/** Hjälprutan med kortkommandon. En dialog, så att den kan stå öppen bredvid kartan. */
export function MindmapHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kortkommandon</DialogTitle>
          <DialogDescription>Tangentbordet först: skriv hela kartan utan mus.</DialogDescription>
        </DialogHeader>
        {[...MINDMAP_SHORTCUTS, ...PAGE_SHORTCUTS].map((group) => (
          <section key={group.group}>
            <h4 className="mm__help-group">{group.group}</h4>
            <dl className="mm__help-list">
              {group.items.map((item) => (
                <div key={item.keys + item.what} className="mm__help-row">
                  <dt><kbd>{item.keys}</kbd></dt>
                  <dd>{item.what}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </DialogContent>
    </Dialog>
  );
}
