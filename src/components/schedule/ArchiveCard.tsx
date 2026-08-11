'use client';

import { Copy, Lock, Share2, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ActiveZone } from '@/hooks/useScheduleKeyboardNav';
import type { PlannerArchiveSummary } from '@/types/schedule';

type ArchiveCardProps = {
  archive: PlannerArchiveSummary;
  /** Plats i den gemensamma listan, som tangentnavigeringen räknar på. */
  index: number;
  isActive: boolean;
  activeZone: ActiveZone | null;
  selectedArchiveIndex: number | null;
  onLoad: (archiveId: string) => void;
  onDuplicate: (archive: PlannerArchiveSummary) => void;
  onShare: (archive: PlannerArchiveSummary) => void;
  onDelete: (archive: PlannerArchiveSummary) => void;
};

export function ArchiveCard({
  archive,
  index,
  isActive,
  activeZone,
  selectedArchiveIndex,
  onLoad,
  onDuplicate,
  onShare,
  onDelete
}: ArchiveCardProps) {
  const isSelected = activeZone === 'archive' && selectedArchiveIndex === index;
  const heldByOther = archive.lock && !archive.lock.isMine ? archive.lock.username : null;

  return (
    <div className={`sp-archive-card p-3 flex items-center gap-2 ${isSelected ? 'sp-ring' : ''}`}>
      <Button
        type="button"
        variant="noShadow"
        onClick={() => onLoad(archive.id)}
        className="h-auto flex-1 min-w-0 flex-col items-start justify-start gap-0.5 whitespace-normal border-0 bg-transparent p-0 text-left shadow-none hover:translate-x-0 hover:translate-y-0 hover:bg-transparent"
      >
        <span className="font-bold text-sm break-words leading-tight">
          {archive.name}{isActive ? ' • aktiv' : ''}
        </span>

        {/* Ägaren behöver se att schemat är delat; mottagaren vems det är. */}
        {!archive.isOwner && archive.ownerUsername && (
          <span className="flex items-center gap-1 text-[11px] font-normal text-gray-500">
            <Users size={11}/> Från {archive.ownerUsername}
          </span>
        )}
        {archive.isOwner && archive.sharedWith.length > 0 && (
          <span className="flex items-center gap-1 text-[11px] font-normal text-gray-500">
            <Users size={11}/> Delad med {archive.sharedWith.join(', ')}
          </span>
        )}
        {heldByOther && (
          <span className="flex items-center gap-1 text-[11px] font-normal text-amber-700">
            <Lock size={11}/> {heldByOther} har det öppet
          </span>
        )}
      </Button>

      <div className="flex shrink-0 gap-2">
        <Button
          size="sm"
          variant="neutral"
          onClick={() => onDuplicate(archive)}
          className="h-8 w-8 p-0 sp-btn bg-indigo-100 hover:bg-indigo-200"
          aria-label={`Duplicera ${archive.name}`}
          title={`Duplicera ${archive.name}`}
        >
          <Copy size={14}/>
        </Button>
        <Button
          size="sm"
          variant="neutral"
          onClick={() => onShare(archive)}
          className="h-8 w-8 p-0 sp-btn bg-emerald-100 hover:bg-emerald-200"
          aria-label={`Dela ${archive.name}`}
          title={`Dela ${archive.name}`}
        >
          <Share2 size={14}/>
        </Button>
        {/* Bara ägaren raderar. Den som fått schemat delat lämnar det i
            delningsrutan i stället — annars skulle en klick i fel kort ta bort
            arbetslagets gemensamma vecka. */}
        {archive.isOwner && (
          <Button
            size="sm"
            variant="neutral"
            onClick={() => onDelete(archive)}
            className="h-8 w-8 p-0 sp-btn bg-rose-100 hover:bg-rose-200 text-rose-800"
            aria-label={`Ta bort ${archive.name}`}
            title={`Ta bort ${archive.name}`}
          >
            <Trash2 size={14}/>
          </Button>
        )}
      </div>
    </div>
  );
}
