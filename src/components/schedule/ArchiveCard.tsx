'use client';

import { useEffect, useRef, useState } from 'react';
import { CalendarDays, Check, Copy, FolderInput, FolderPlus, Layers, Lock, MoreHorizontal, Share2, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { uiTint } from '@/components/ui/tints';
import { ActiveLamp } from '@/components/ui/ActiveLamp';
import type { ActiveZone } from '@/hooks/useScheduleKeyboardNav';
import type { PlannerArchiveSummary } from '@/types/schedule';
import { isBaseSchedule } from '@/utils/scheduleKind';
import { folderNameOf } from '@/utils/scheduleFolders';

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
  /** Gör om till basschema eller veckoschema. Bara ägaren ser valet. */
  onChangeKind: (archive: PlannerArchiveSummary) => void;
  /**
   * Mapparna som syns i panelen, eller null när backend saknar mappar. Bara
   * ägarens veckoscheman kan flyttas.
   */
  folderNames: string[] | null;
  onMoveToFolder: (archive: PlannerArchiveSummary, folder: string | null) => void;
  /** Ny mapp… i menyn: dialogen öppnas med kortet förkryssat. */
  onNewFolderWith: (archive: PlannerArchiveSummary) => void;
  /** Menyn öppnas eller stängs. Tangentnavigeringen pausas medan den är öppen. */
  onMenuOpenChange: (open: boolean) => void;
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
  onDelete,
  onChangeKind,
  folderNames,
  onMoveToFolder,
  onNewFolderWith,
  onMenuOpenChange
}: ArchiveCardProps) {
  const isBase = isBaseSchedule(archive);
  const currentFolder = folderNameOf(archive);
  const canMove = archive.isOwner && !isBase && folderNames !== null;
  // Knapparna visas bara vid hovring. Medan menyn är öppen ligger fokus i
  // menyn och pekaren ofta utanför kortet, och då får knappen den hänger på
  // inte försvinna.
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const handleMenuOpenChange = (open: boolean) => {
    setIsMenuOpen(open);
    onMenuOpenChange(open);
  };
  // Försvinner kortet med menyn öppen (det flyttades in i en hopfälld mapp)
  // måste stängningen ändå räknas, annars förblir tangentnavigeringen pausad.
  const menuCloseRef = useRef<(() => void) | null>(null);
  menuCloseRef.current = isMenuOpen ? () => onMenuOpenChange(false) : null;
  useEffect(() => () => menuCloseRef.current?.(), []);
  const changeKindLabel = isBase ? 'Gör till veckoschema' : 'Gör till basschema';
  const isSelected = activeZone === 'archive' && selectedArchiveIndex === index;
  const heldByOther = archive.lock && !archive.lock.isMine ? archive.lock.username : null;

  return (
    <div className={`group sp-archive-card p-3 flex items-center gap-2 ${isActive ? 'sp-archive-card-active' : ''} ${isSelected ? 'sp-ring' : ''}`}>
      <Button
        type="button"
        variant="noShadow"
        onClick={() => onLoad(archive.id)}
        className="h-auto flex-1 min-w-0 flex-col items-start justify-start gap-0.5 whitespace-normal border-0 bg-transparent p-0 text-left shadow-none hover:translate-x-0 hover:translate-y-0 hover:bg-transparent"
      >
        <span className="flex min-w-0 items-center gap-2">
          {/* Lampan för det öppna schemat. Bara i Kronberg; Neo skriver "• aktiv". */}
          <ActiveLamp on={isActive} />
          <span className="font-bold text-sm break-words leading-tight kron:font-medium">
            {archive.name}{isActive && <span className="kron:hidden"> • aktiv</span>}
          </span>
          {isActive && <span className="ui-label hidden text-[10px] kron:inline">Öppet</span>}
        </span>

        {/* Ägaren behöver se att schemat är delat; mottagaren vems det är. */}
        {!archive.isOwner && archive.ownerUsername && (
          <span className="flex items-center gap-1 text-[11px] font-normal text-ui-muted">
            <Users size={11}/> Från {archive.ownerUsername}
          </span>
        )}
        {archive.isOwner && archive.sharedWith.length > 0 && (
          <span className="flex items-center gap-1 text-[11px] font-normal text-ui-muted">
            <Users size={11}/> Delad med {archive.sharedWith.join(', ')}
          </span>
        )}
        {heldByOther && (
          <span className="flex items-center gap-1 text-[11px] font-normal text-amber-700">
            <Lock size={11}/> {heldByOther} har det öppet
          </span>
        )}
      </Button>

      {/* Syns vid hovring, fokus eller tangentbordsmarkering, och tar ingen
          plats annars, så att namnet inte kortas av i onödan. På pekskärm
          finns ingen hovring, och där syns de alltid. */}
      <div className={`${isSelected || isMenuOpen ? 'flex' : 'hidden'} shrink-0 gap-1.5 group-hover:flex group-focus-within:flex [@media(pointer:coarse)]:flex`}>
        <Button
          size="sm"
          variant="neutral"
          onClick={() => onDuplicate(archive)}
          className={`h-7 w-7 p-0 sp-btn ${uiTint.info}`}
          aria-label={`Duplicera ${archive.name}`}
          title={`Duplicera ${archive.name}`}
        >
          <Copy size={14}/>
        </Button>
        <Button
          size="sm"
          variant="neutral"
          onClick={() => onShare(archive)}
          className={`h-7 w-7 p-0 sp-btn ${uiTint.create}`}
          aria-label={`Dela ${archive.name}`}
          title={`Dela ${archive.name}`}
        >
          <Share2 size={14}/>
        </Button>
        {/* Bara ägaren byter sort och mapp, som i backend: båda avgör var
            schemat syns för alla som har det. De ligger i en meny, eftersom en
            femte knapp lämnade för lite plats åt namnet. */}
        {archive.isOwner && (
          <DropdownMenu modal={false} onOpenChange={handleMenuOpenChange}>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="neutral"
                className="h-7 w-7 p-0 sp-btn"
                aria-label={`Fler val för ${archive.name}`}
                title="Fler val"
              >
                <MoreHorizontal size={14}/>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {canMove && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="gap-2">
                    <FolderInput size={14}/> Flytta till mapp
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="max-h-80 w-56 overflow-y-auto">
                    {folderNames.map(name => (
                      <DropdownMenuItem
                        key={name}
                        disabled={name === currentFolder}
                        onSelect={() => onMoveToFolder(archive, name)}
                      >
                        <span className="flex w-4 justify-center">{name === currentFolder && <Check size={14}/>}</span>
                        <span className="truncate">{name}</span>
                      </DropdownMenuItem>
                    ))}
                    {folderNames.length > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuItem
                      disabled={currentFolder === null}
                      onSelect={() => onMoveToFolder(archive, null)}
                    >
                      <span className="flex w-4 justify-center">{currentFolder === null && <Check size={14}/>}</span>
                      Utan mapp
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onNewFolderWith(archive)}>
                      <FolderPlus size={14}/> Ny mapp…
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              <DropdownMenuItem onSelect={() => onChangeKind(archive)}>
                {isBase ? <CalendarDays size={14}/> : <Layers size={14}/>} {changeKindLabel}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {/* Bara ägaren raderar. Den som fått schemat delat lämnar det i
            delningsrutan i stället — annars skulle en klick i fel kort ta bort
            arbetslagets gemensamma vecka. */}
        {archive.isOwner && (
          <Button
            size="sm"
            variant="neutral"
            onClick={() => onDelete(archive)}
            className={`h-7 w-7 p-0 sp-btn ${uiTint.danger}`}
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
