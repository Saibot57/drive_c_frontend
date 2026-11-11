'use client';

import React, { useState } from 'react';
import { AlertTriangle, Check, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FeatureNavigation } from '@/components/FeatureNavigation';
import { useAuth } from '@/contexts/AuthContext';
import { type MindmapSaveStatus, useMindmapSync } from '@/hooks/useMindmapSync';
import { cn } from '@/lib/utils';
import MindmapCanvas from './MindmapCanvas';
import { MindmapImportButton } from './MindmapImportButton';
import { MindmapList } from './MindmapList';
import '@/styles/schedule-theme.css';
import './mindmap.css';

/**
 * Mindmap-sidan (`/features/mindmap`): sparade kartor till vänster, kartan
 * till höger. Allt som rör sparningen ligger i useMindmapSync; kartan själv
 * i MindmapCanvas. Planen: docs/plans/mindmap-sida.md.
 */

const SAVE_LABEL: Record<MindmapSaveStatus, string> = {
  saved: 'Sparat',
  pending: 'Ändrat',
  saving: 'Sparar…',
  error: 'Kunde inte spara. Försöker igen.',
  conflict: 'Ändrad någon annanstans',
};

function SaveIndicator({ status, error }: { status: MindmapSaveStatus; error: string | null }) {
  const Icon = status === 'saved' ? Check : status === 'error' || status === 'conflict' ? AlertTriangle : Loader2;
  return (
    <span role="status" className="flex items-center gap-1.5 whitespace-nowrap text-xs text-ui-muted" title={error ?? undefined}>
      <Icon size={14} className={cn((status === 'saving' || status === 'pending') && 'animate-spin')} />
      {SAVE_LABEL[status]}
    </span>
  );
}

export default function Mindmap() {
  const { user } = useAuth();
  const sync = useMindmapSync(user?.id ?? null);
  const [listOpen, setListOpen] = useState(true);

  return (
    <div className="sp-root">
      <div className="ui-backdrop fixed inset-0 z-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/bakgrund59.png" alt="" className="h-full w-full object-cover" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col gap-4 p-4">
        <div className="sp-toolbar flex flex-wrap items-center gap-4 p-4">
          <FeatureNavigation />
          {sync.active && (
            <p className="min-w-0 truncate font-mono text-xs uppercase tracking-wider text-ui-muted" title={sync.active.name}>
              {sync.active.name}
            </p>
          )}
        </div>

        {sync.notice && (
          <div role="alert" className="sp-toast flex flex-wrap items-center justify-between gap-3 bg-ui-mark-yellow px-4 py-2 text-sm font-semibold text-ui-mark-fg">
            <span>{sync.notice}</span>
            <button type="button" className="text-xs font-semibold underline" onClick={sync.dismissNotice}>Stäng</button>
          </div>
        )}

        {sync.saveStatus === 'conflict' && (
          <div role="alert" className="sp-toast flex flex-wrap items-center justify-between gap-3 bg-ui-mark-pink px-4 py-2 text-sm font-semibold text-ui-mark-fg">
            <span>Kartan har ändrats någon annanstans. Den senaste ändringen här är inte sparad.</span>
            <span className="flex flex-wrap gap-2">
              <Button variant="neutral" size="sm" className="sp-btn" onClick={() => void sync.reloadActive()} disabled={sync.busy}>
                <RefreshCw /> Ladda den sparade versionen
              </Button>
              <Button variant="neutral" size="sm" className="sp-btn" onClick={sync.keepMine} disabled={sync.busy}>
                Behåll min
              </Button>
            </span>
          </div>
        )}

        {sync.saveStatus === 'error' && (
          <div role="alert" className="sp-toast flex flex-wrap items-center justify-between gap-3 bg-ui-mark-pink px-4 py-2 text-sm font-semibold text-ui-mark-fg">
            <span>Kunde inte spara{sync.saveError ? `: ${sync.saveError}` : ''}. Ändringarna finns kvar här.</span>
            <button type="button" className="text-xs font-semibold underline" onClick={sync.retrySave}>Försök igen</button>
          </div>
        )}

        {sync.phase !== 'ready' ? (
          <div className="sp-card mx-auto mt-10 flex max-w-md flex-col items-center gap-3 p-6 text-center text-sm">
            {sync.phase === 'error' ? (
              <>
                <AlertTriangle size={20} className="text-ui-danger" />
                <p>{sync.loadError ?? 'Servern svarar inte.'}</p>
                <Button variant="neutral" className="sp-btn" onClick={() => void sync.retryLoad()}>Försök igen</Button>
              </>
            ) : (
              <>
                <Loader2 size={20} className="animate-spin" />
                <p>Hämtar kartorna…</p>
              </>
            )}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
            <MindmapList list={sync} open={listOpen} onOpenChange={setListOpen} />
            <div className="sp-card flex min-h-[60vh] flex-1 flex-col lg:min-h-0">
              {sync.active ? (
                <MindmapCanvas
                  mapId={sync.active.id}
                  doc={sync.active.doc}
                  title={sync.active.name}
                  onChange={sync.update}
                  onImport={(file) => void sync.importFile(file)}
                  status={<SaveIndicator status={sync.saveStatus} error={sync.saveError} />}
                />
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-ui-muted">
                  <p>Ingen karta är öppen.</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button variant="neutral" className="sp-btn" onClick={() => void sync.create()} disabled={sync.busy}>Ny karta</Button>
                    <MindmapImportButton onFile={(file) => void sync.importFile(file)} disabled={sync.busy} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
