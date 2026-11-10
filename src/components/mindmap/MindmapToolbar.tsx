'use client';

import {
  ArrowLeftRight,
  ChevronsDownUp,
  Download,
  Keyboard,
  Palette,
  Plus,
  Redo2,
  Undo2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MINDMAP_COLORS, MINDMAP_COLOR_LABELS, type MindmapColor, type MindmapLayout } from '@/types/mindmap';
import { MindmapHelp } from './MindmapHelp';

export type MindmapMenu = 'color' | 'export' | 'help' | null;

export type MindmapExportKind = 'image' | 'list' | 'headings' | 'png';

interface MindmapToolbarProps {
  layout: MindmapLayout;
  menu: MindmapMenu;
  canCopyImage: boolean;
  onMenu: (menu: MindmapMenu) => void;
  onAddChild: () => void;
  onToggleCollapse: () => void;
  onColor: (color: MindmapColor | null) => void;
  onLayout: (layout: MindmapLayout) => void;
  onUndo: () => void;
  onRedo: () => void;
  onExport: (kind: MindmapExportKind) => void;
  /** Till höger: sparstatus och kartans namn. */
  status?: React.ReactNode;
}

/** Verktygsraden ovanför kartan. Knapparna tar inte fokus från kartan längre än klicket. */
export default function MindmapToolbar({
  layout,
  menu,
  canCopyImage,
  onMenu,
  onAddChild,
  onToggleCollapse,
  onColor,
  onLayout,
  onUndo,
  onRedo,
  onExport,
  status,
}: MindmapToolbarProps) {
  const toggle = (next: Exclude<MindmapMenu, null>) => onMenu(menu === next ? null : next);
  const choose = (kind: MindmapExportKind) => {
    onMenu(null);
    onExport(kind);
  };
  const tool = 'sp-btn h-8 w-8 p-0';

  return (
    <div className="relative flex flex-wrap items-center gap-2 border-b border-ui-line px-3 py-2">
      <Button size="sm" variant="neutral" className={tool} onClick={onAddChild} title="Ny nod under (Tab)" aria-label="Ny nod under">
        <Plus size={15} />
      </Button>
      <div className="relative">
        <Button
          size="sm"
          variant="neutral"
          className={tool}
          onClick={() => toggle('color')}
          title="Färg (Alt+1–6)"
          aria-label="Färg"
          aria-expanded={menu === 'color'}
        >
          <Palette size={15} />
        </Button>
        {menu === 'color' && (
          <div className="mm__popover mm__swatches">
            {MINDMAP_COLORS.map((color, index) => (
              <button
                key={color}
                type="button"
                className={`mm__swatch mm__swatch--${color}`}
                onClick={() => onColor(color)}
                title={`${MINDMAP_COLOR_LABELS[color]} (Alt+${index + 1})`}
                aria-label={MINDMAP_COLOR_LABELS[color]}
              />
            ))}
            <button type="button" className="mm__swatch mm__swatch--none" onClick={() => onColor(null)} title="Ingen färg (Alt+0)" aria-label="Ingen färg">
              <X size={11} />
            </button>
          </div>
        )}
      </div>
      <Button size="sm" variant="neutral" className={tool} onClick={onToggleCollapse} title="Fäll ihop eller ut (mellanslag)" aria-label="Fäll ihop eller ut">
        <ChevronsDownUp size={15} />
      </Button>
      <Button
        size="sm"
        variant="neutral"
        className={tool}
        onClick={() => onLayout(layout === 'both' ? 'right' : 'both')}
        title={layout === 'both' ? 'Alla grenar åt höger' : 'Grenar åt båda hållen'}
        aria-label={layout === 'both' ? 'Alla grenar åt höger' : 'Grenar åt båda hållen'}
        aria-pressed={layout === 'both'}
      >
        <ArrowLeftRight size={15} />
      </Button>
      <span className="mx-1 h-5 w-px bg-ui-line" aria-hidden />
      <Button size="sm" variant="neutral" className={tool} onClick={onUndo} title="Ångra (Ctrl+Z)" aria-label="Ångra">
        <Undo2 size={15} />
      </Button>
      <Button size="sm" variant="neutral" className={tool} onClick={onRedo} title="Gör om (Ctrl+Shift+Z)" aria-label="Gör om">
        <Redo2 size={15} />
      </Button>
      <span className="mx-1 h-5 w-px bg-ui-line" aria-hidden />
      <div className="relative">
        <Button
          size="sm"
          variant="neutral"
          className="sp-btn h-8"
          onClick={() => toggle('export')}
          aria-expanded={menu === 'export'}
        >
          <Download size={15} /> Exportera
        </Button>
        {menu === 'export' && (
          <div className="mm__popover mm__menu">
            {canCopyImage && (
              <button type="button" className="mm__menu-item" onClick={() => choose('image')}>Kopiera som bild</button>
            )}
            <button type="button" className="mm__menu-item" onClick={() => choose('list')}>Kopiera som punktlista</button>
            <button type="button" className="mm__menu-item" onClick={() => choose('headings')}>Kopiera som rubriker och punkter</button>
            <button type="button" className="mm__menu-item" onClick={() => choose('png')}>Ladda ner som PNG</button>
            <p className="mm__menu-hint">Klistra in i Google Docs med Ctrl+V.</p>
          </div>
        )}
      </div>
      <Button size="sm" variant="neutral" className={tool} onClick={() => toggle('help')} title="Kortkommandon" aria-label="Kortkommandon" aria-expanded={menu === 'help'}>
        <Keyboard size={15} />
      </Button>
      <MindmapHelp open={menu === 'help'} onClose={() => onMenu(null)} />

      {status && <div className="ml-auto flex min-w-0 items-center gap-3">{status}</div>}
    </div>
  );
}
