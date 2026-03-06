'use client';

import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { commandCenterService } from '@/services/commandCenterService';
import type { CCNote } from '@/services/commandCenterService';

interface Props {
  /** id of the note to edit, or null when closed */
  noteId:  string | null;
  onClose: () => void;
  onSaved: () => void;
}

export function EditNoteModal({ noteId, onClose, onSaved }: Props) {
  const [note, setNote]         = useState<CCNote | null>(null);
  const [title, setTitle]       = useState('');
  const [content, setContent]   = useState('');
  const [tagsRaw, setTagsRaw]   = useState(''); // comma-separated string
  const [isLoading, setLoading] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // Fetch note when modal opens
  useEffect(() => {
    if (!noteId) { setNote(null); return; }
    setLoading(true);
    setError(null);
    commandCenterService.getNote(noteId)
      .then(n => {
        setNote(n);
        setTitle(n.title);
        setContent(n.content ?? '');
        setTagsRaw(n.tags.join(', '));
      })
      .catch(e  => setError(e.message ?? 'Kunde inte hämta anteckning.'))
      .finally(() => setLoading(false));
  }, [noteId]);

  const handleSave = () => {
    if (!noteId) return;
    const tags = tagsRaw
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    // Optimistic: close immediately, save in background
    onSaved();
    onClose();

    commandCenterService.updateNote(noteId, {
      title: title.trim(),
      content,
      tags,
    }).catch(() => {
      // Trigger a refresh so the UI reflects the actual state
      onSaved();
    });
  };

  return (
    <Dialog open={!!noteId} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Redigera anteckning</DialogTitle>
        </DialogHeader>

        {isLoading && <p className="text-sm text-gray-500">Laddar…</p>}
        {error     && <p className="text-sm text-red-500">{error}</p>}

        {!isLoading && note && (
          <div className="space-y-4">

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest mb-1">
                Titel
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full border-2 border-black px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest mb-1">
                Innehåll
              </label>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                rows={10}
                className="w-full border-2 border-black px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest mb-1">
                Taggar <span className="text-gray-400 normal-case font-normal">(kommaseparerade)</span>
              </label>
              <input
                type="text"
                value={tagsRaw}
                onChange={e => setTagsRaw(e.target.value)}
                placeholder="t.ex. arbete, idé, projekt"
                className="w-full border-2 border-black px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>

            <p className="text-2xs text-gray-300 font-mono">id: {note.id}</p>
          </div>
        )}

        <DialogFooter>
          <Button variant="neutral" onClick={onClose}>
            Avbryt
          </Button>
          <Button onClick={handleSave} disabled={isLoading || !note}>
            Spara
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
