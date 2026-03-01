'use client';

import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { commandCenterService } from '@/services/commandCenterService';
import type { CCTemplate } from '@/services/commandCenterService';

interface Props {
  open:    boolean;
  onClose: () => void;
}

export function TemplatesModal({ open, onClose }: Props) {
  const [templates, setTemplates] = useState<CCTemplate[]>([]);
  const [name, setName]           = useState('');
  const [skeleton, setSkeleton]   = useState('');
  const [isLoading, setLoading]   = useState(false);
  const [isSaving, setSaving]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    commandCenterService.getTemplates()
      .then(setTemplates)
      .catch(e  => setError(e.message ?? 'Kunde inte hämta mallar.'))
      .finally(() => setLoading(false));
  }, [open]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const t = await commandCenterService.createTemplate(name.trim(), skeleton);
      setTemplates(prev => [...prev, t]);
      setName('');
      setSkeleton('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Kunde inte skapa mall.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    // Optimistic
    setTemplates(prev => prev.filter(t => t.id !== id));
    try {
      await commandCenterService.deleteTemplate(id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Kunde inte ta bort mall.');
      // Reload to restore correct state
      commandCenterService.getTemplates().then(setTemplates).catch(() => null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Mallar</DialogTitle>
        </DialogHeader>

        {error && <p className="text-sm text-red-500">{error}</p>}

        {/* Existing templates */}
        <div className="space-y-2 max-h-52 overflow-auto pr-1">
          {isLoading && <p className="text-xs text-gray-400">Laddar…</p>}
          {!isLoading && templates.length === 0 && (
            <p className="text-xs text-gray-400">Inga mallar än. Skapa en nedan.</p>
          )}
          {templates.map(t => (
            <div
              key={t.id}
              className="flex items-start justify-between border-2 border-black p-2.5 shadow-[2px_2px_0px_0px_black] gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold">{t.name}</p>
                {t.skeleton && (
                  <p className="text-[10px] text-gray-400 font-mono mt-0.5 truncate">
                    {t.skeleton.slice(0, 70)}{t.skeleton.length > 70 ? '…' : ''}
                  </p>
                )}
                <p className="text-[9px] text-gray-300 font-mono mt-1">
                  Använd via: note &quot;Titel&quot; --mall {t.name}
                </p>
              </div>
              <button
                onClick={() => handleDelete(t.id)}
                className="shrink-0 p-1 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors"
                title="Ta bort mall"
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </button>
            </div>
          ))}
        </div>

        {/* Create form */}
        <div className="border-t-2 border-black pt-4 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-widest">Ny mall</h3>

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest mb-1">
              Namn *
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="t.ex. mötesanteckning"
              className="w-full border-2 border-black px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest mb-1">
              Skelett{' '}
              <span className="text-gray-400 normal-case font-normal">(Markdown, valfritt)</span>
            </label>
            <textarea
              value={skeleton}
              onChange={e => setSkeleton(e.target.value)}
              rows={6}
              placeholder={'## Agenda\n\n## Beslut\n\n## Nästa steg'}
              className="w-full border-2 border-black px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black resize-none"
            />
          </div>

          <Button onClick={handleCreate} disabled={isSaving || !name.trim()}>
            {isSaving ? 'Skapar…' : '+ Skapa mall'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
