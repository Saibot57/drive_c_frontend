'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown, ChevronRight, Folder, FolderOpen, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ActiveLamp } from '@/components/ui/ActiveLamp';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import type { FolderGroup } from '@/utils/scheduleFolders';

type ArchiveFolderProps = {
  group: FolderGroup;
  isExpanded: boolean;
  /** Det öppna schemat ligger i mappen. Syns bara när mappen är hopfälld. */
  containsActive: boolean;
  onToggle: () => void;
  /** Användaren har egna veckoscheman utanför mappen att lägga i den. */
  canAdd: boolean;
  /** Användaren äger något schema i mappen, och kan byta namn på eller ta bort den. */
  canEdit: boolean;
  onAdd: () => void;
  onRename: () => void;
  onDelete: () => void;
  onMenuOpenChange: (open: boolean) => void;
  /** Korten, när mappen är utfälld. */
  children: ReactNode;
};

/** En mapp i högerpanelen: en rubrik som fäller in och ut, och korten under den. */
export function ArchiveFolder({
  group,
  isExpanded,
  containsActive,
  onToggle,
  canAdd,
  canEdit,
  onAdd,
  onRename,
  onDelete,
  onMenuOpenChange,
  children
}: ArchiveFolderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  // Som på kortet: en mapp som försvinner med menyn öppen räknas som stängd.
  const menuCloseRef = useRef<(() => void) | null>(null);
  menuCloseRef.current = isMenuOpen ? () => onMenuOpenChange(false) : null;
  useEffect(() => () => menuCloseRef.current?.(), []);
  const showsActive = containsActive && !isExpanded;
  const hasMenu = canAdd || canEdit;
  const FolderIcon = isExpanded ? FolderOpen : Folder;

  return (
    <div className="space-y-2">
      <div className="group sp-archive-card flex items-center gap-1 py-2 pl-2 pr-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isExpanded}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-ui text-left text-sm font-bold kron:font-medium"
        >
          {isExpanded ? <ChevronDown size={14} className="shrink-0"/> : <ChevronRight size={14} className="shrink-0"/>}
          <FolderIcon size={15} className="shrink-0 text-ui-muted"/>
          {/* Lampan visar att det öppna schemat ligger här, när det inte syns. */}
          <ActiveLamp on={showsActive} />
          <span className="min-w-0 break-words leading-tight">
            {group.name}{showsActive && <span className="font-normal kron:hidden"> • öppet</span>}
          </span>
          <span className="ml-auto shrink-0 pl-1 text-xs font-normal text-ui-muted">{group.archives.length}</span>
        </button>

        {hasMenu && (
          <DropdownMenu
            modal={false}
            onOpenChange={open => {
              setIsMenuOpen(open);
              onMenuOpenChange(open);
            }}
          >
            <DropdownMenuTrigger asChild>
              {/* Syns som kortens knappar: vid hovring, fokus, öppen meny och på pekskärm. */}
              <Button
                size="sm"
                variant="neutral"
                className={`${isMenuOpen ? 'flex' : 'hidden'} h-7 w-7 shrink-0 p-0 sp-btn group-hover:flex group-focus-within:flex [@media(pointer:coarse)]:flex`}
                aria-label={`Fler val för mappen ${group.name}`}
                title="Fler val"
              >
                <MoreHorizontal size={14}/>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {canAdd && (
                <DropdownMenuItem onSelect={onAdd}>
                  <Plus size={14}/> Lägg till scheman…
                </DropdownMenuItem>
              )}
              {canEdit && (
                <DropdownMenuItem onSelect={onRename}>
                  <Pencil size={14}/> Byt namn
                </DropdownMenuItem>
              )}
              {canEdit && (
                <DropdownMenuItem onSelect={onDelete}>
                  <Trash2 size={14}/> Ta bort mapp
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {isExpanded && (
        <div className="ml-3 space-y-2 border-l-2 border-ui-hair pl-2">
          {children}
        </div>
      )}
    </div>
  );
}
