'use client';

import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { commandCenterService } from '@/services/commandCenterService';
import type { CCNote } from '@/services/commandCenterService';

interface Props {
  noteId: string | null;
  onClose: () => void;
  onEditRequest: (id: string) => void;
}

export function ViewNoteModal({ noteId, onClose, onEditRequest }: Props) {
  const [note, setNote] = useState<CCNote | null>(null);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!noteId) { setNote(null); return; }
    setLoading(true);
    setError(null);
    commandCenterService.getNote(noteId)
      .then(n => setNote(n))
      .catch(e => setError(e.message ?? 'Kunde inte hämta anteckning.'))
      .finally(() => setLoading(false));
  }, [noteId]);

  return (
    <Dialog open={!!noteId} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{note?.title ?? 'Anteckning'}</DialogTitle>
        </DialogHeader>

        {isLoading && <p className="text-sm text-gray-500">Laddar…</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}

        {!isLoading && note && (
          <div className="space-y-4">
            {note.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {note.tags.map(tag => (
                  <span
                    key={tag}
                    className="text-[10px] px-2 py-0.5 border border-black bg-[#fef9c3] font-mono leading-none"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {note.content ? (
              <div className="border-2 border-black p-4 bg-white font-mono text-sm whitespace-pre-wrap leading-relaxed min-h-[120px]">
                {note.content}
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">Inget innehåll.</p>
            )}

            <p className="text-[10px] text-gray-300 font-mono">id: {note.id}</p>
          </div>
        )}

        <DialogFooter>
          <Button variant="neutral" onClick={onClose}>
            Stäng
          </Button>
          <Button
            onClick={() => { if (noteId) onEditRequest(noteId); }}
            disabled={isLoading || !note}
          >
            Redigera
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
