'use client';

import { Cloud, CloudOff, Loader2 } from 'lucide-react';
import type { SaveStatus } from '../hooks/useWorkspaceSync';

const TEXT: Record<SaveStatus, string> = {
  idle: 'Sparat',
  saving: 'Sparar…',
  saved: 'Sparat',
  error: 'Ej sparat',
};

/** Speglar temakalenderns molnindikator, så att de två känns som samma app. */
export default function SaveIndicator({ status }: { status: SaveStatus }) {
  return (
    <span
      className={`ws-save-status ${status === 'error' ? 'ws-save-status--error' : ''}`}
      title={status === 'error' ? 'Ändringarna nådde inte servern' : 'Sparas automatiskt'}
    >
      {status === 'saving' && <Loader2 size={13} className="ws-spin" />}
      {status === 'error' && <CloudOff size={13} />}
      {status !== 'saving' && status !== 'error' && <Cloud size={13} />}
      {TEXT[status]}
    </span>
  );
}
