'use client';

import {
  ArrowLeftRight,
  ChevronsDownUp,
  Download,
  Focus,
  Keyboard,
  Palette,
  ListTree,
  PanelRight,
  Plus,
  Presentation,
  Redo2,
  Undo2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { MindmapLayout } from '@/types/mindmap';
import type { MindmapShading } from '@/types/mindmapDoc';
import type { MindmapPaintChoice } from '@/utils/mindmapPaint';
import { MINDMAP_PALETTE, MINDMAP_RECENT_COLORS_KEY, MINDMAP_RECENT_COLORS_MAX } from '@/config/mindmapPalette';
import { useRecentColors } from '@/hooks/useRecentColors';
import { MindmapColorMenu } from './MindmapColorMenu';
import { MindmapHelp } from './MindmapHelp';
import { MindmapImportButton } from './MindmapImportButton';

export type MindmapMenu = 'color' | 'export' | 'help' | null;

export type MindmapExportKind = 'image' | 'list' | 'headings' | 'png' | 'pdf' | 'markdown' | 'json';

interface MindmapToolbarProps {
  layout: MindmapLayout;
  menu: MindmapMenu;
  canCopyImage: boolean;
  onMenu: (menu: MindmapMenu) => void;
  onAddChild: () => void;
  onToggleCollapse: () => void;
  /** `wholeBranch`: färgen sätts på noden och grenen under den. */
  onColor: (choice: MindmapPaintChoice | null, wholeBranch: boolean) => void;
  /** Den markerade nodens sparade färg, som menyn visar som vald. */
  currentColor: MindmapPaintChoice | null;
  /** Kartans nyanser nedåt. */
  shading: MindmapShading;
  onShading: (shading: MindmapShading) => void;
  /** Panelen med anteckning, länk, bild och ikon. */
  panelOpen?: boolean;
  onTogglePanel?: () => void;
  /** Finns det noder som flyttats för hand? Då går placeringen att nollställa. */
  canResetLayout?: boolean;
  onResetLayout?: () => void;
  onLayout: (layout: MindmapLayout) => void;
  onUndo: () => void;
  onRedo: () => void;
  onExport: (kind: MindmapExportKind) => void;
  /** Genomskinlig bakgrund i bilden och PNG:n. */
  transparent?: boolean;
  onTransparent?: (transparent: boolean) => void;
  /** En vald fil att importera som ny karta. Utan den visas ingen knapp. */
  onImport?: (file: File) => void;
  /** "Visa bara grenen" är på. */
  branchActive?: boolean;
  onToggleBranch?: () => void;
  /** Startar presentationsläget. */
  onPresent?: () => void;
  /** Zoomnivån och dess knappar (MindmapZoom). */
  zoom?: React.ReactNode;
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
  currentColor,
  shading,
  onShading,
  panelOpen,
  onTogglePanel,
  canResetLayout,
  onResetLayout,
  onLayout,
  onUndo,
  onRedo,
  onExport,
  transparent,
  onTransparent,
  onImport,
  branchActive,
  onToggleBranch,
  onPresent,
  zoom,
  status,
}: MindmapToolbarProps) {
  const toggle = (next: Exclude<MindmapMenu, null>) => onMenu(menu === next ? null : next);
  const choose = (kind: MindmapExportKind) => {
    onMenu(null);
    onExport(kind);
  };
  const tool = 'sp-btn h-8 w-8 p-0';
  const { recentColors, rememberColor } = useRecentColors(MINDMAP_RECENT_COLORS_KEY, MINDMAP_RECENT_COLORS_MAX, MINDMAP_PALETTE);

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
          <MindmapColorMenu
            current={currentColor}
            shading={shading}
            onColor={onColor}
            onShading={onShading}
            recentColors={recentColors}
            rememberColor={rememberColor}
          />
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
      {onResetLayout && (
        <Button
          size="sm"
          variant="neutral"
          className={tool}
          onClick={onResetLayout}
          disabled={!canResetLayout}
          title="Nollställ placeringen i hela kartan (Alt+Shift+0 för en nod)"
          aria-label="Nollställ placeringen i hela kartan"
        >
          <ListTree size={15} />
        </Button>
      )}
      {onToggleBranch && (
        <Button
          size="sm"
          variant="neutral"
          className={tool}
          onClick={onToggleBranch}
          title={branchActive ? 'Visa hela kartan (Esc)' : 'Visa bara grenen (Alt+Enter)'}
          aria-label={branchActive ? 'Visa hela kartan' : 'Visa bara grenen'}
          aria-pressed={!!branchActive}
        >
          <Focus size={15} />
        </Button>
      )}
      {onTogglePanel && (
        <Button
          size="sm"
          variant="neutral"
          className={tool}
          onClick={onTogglePanel}
          title="Anteckning, länk, bild och ikon (Alt+N)"
          aria-label="Anteckning, länk, bild och ikon"
          aria-pressed={panelOpen}
        >
          <PanelRight size={15} />
        </Button>
      )}
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
            {onTransparent && (
              <label className="mm__swatch-option mm__menu-option">
                <input type="checkbox" checked={!!transparent} onChange={(e) => onTransparent(e.target.checked)} />
                Genomskinlig bakgrund (bild och PNG)
              </label>
            )}
            <p className="mm__menu-hint">Klistra in i Google Docs med Ctrl+V. Alt+Shift+C kopierar bilden.</p>
            <span className="mm__menu-rule" aria-hidden />
            <button type="button" className="mm__menu-item" onClick={() => choose('pdf')}>Ladda ner som PDF</button>
            <button type="button" className="mm__menu-item" onClick={() => choose('markdown')}>Ladda ner som Markdown</button>
            <button type="button" className="mm__menu-item" onClick={() => choose('json')}>Ladda ner som JSON</button>
            <p className="mm__menu-hint">JSON går att importera igen som en ny karta.</p>
          </div>
        )}
      </div>
      {onImport && <MindmapImportButton onFile={onImport} />}
      {onPresent && (
        <Button size="sm" variant="neutral" className="sp-btn h-8" onClick={onPresent} title="Presentera kartan gren för gren (Alt+P)">
          <Presentation size={15} /> Presentera
        </Button>
      )}
      <Button size="sm" variant="neutral" className={tool} onClick={() => toggle('help')} title="Kortkommandon" aria-label="Kortkommandon" aria-expanded={menu === 'help'}>
        <Keyboard size={15} />
      </Button>
      <MindmapHelp open={menu === 'help'} onClose={() => onMenu(null)} />
      {zoom && (
        <div className="flex items-center gap-2">
          <span className="mx-1 h-5 w-px bg-ui-line" aria-hidden />
          {zoom}
        </div>
      )}

      {status && <div className="ml-auto flex min-w-0 items-center gap-3">{status}</div>}
    </div>
  );
}
