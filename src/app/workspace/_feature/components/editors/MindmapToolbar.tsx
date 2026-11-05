'use client';

import {
  ArrowLeftRight,
  ChevronsDownUp,
  Copy,
  Keyboard,
  Palette,
  Plus,
  Redo2,
  Undo2,
  X,
} from 'lucide-react';
import {
  MINDMAP_COLORS,
  MINDMAP_COLOR_LABELS,
  type MindmapColor,
  type MindmapLayout,
} from '../../types/mindmap.types';
import { MINDMAP_SHORTCUTS } from '../../utils/mindmapKeys';

export type MindmapMenu = 'color' | 'export' | 'help' | null;

export type MindmapExportKind = 'image' | 'list' | 'headings' | 'png';

interface MindmapToolbarProps {
  isLocked: boolean;
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
}

/** Knapparna får inte starta en kortflytt när man trycker på dem. */
const stop = (e: React.PointerEvent) => e.stopPropagation();

export default function MindmapToolbar({
  isLocked,
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
}: MindmapToolbarProps) {
  const toggle = (next: Exclude<MindmapMenu, null>) => onMenu(menu === next ? null : next);
  const choose = (kind: MindmapExportKind) => {
    onMenu(null);
    onExport(kind);
  };

  return (
    <>
      <div className="ws-mindmap__toolbar" data-export="omit" onPointerDown={stop}>
        {!isLocked && (
          <>
            <button type="button" className="ws-mindmap__tool" onClick={onAddChild} title="Ny nod under (Tab)">
              <Plus size={13} />
            </button>
            <button
              type="button"
              className="ws-mindmap__tool"
              onClick={() => toggle('color')}
              title="Färg (Alt+1–6)"
              aria-expanded={menu === 'color'}
            >
              <Palette size={13} />
            </button>
            <button type="button" className="ws-mindmap__tool" onClick={onToggleCollapse} title="Fäll ihop eller ut (mellanslag)">
              <ChevronsDownUp size={13} />
            </button>
            <button
              type="button"
              className="ws-mindmap__tool"
              onClick={() => onLayout(layout === 'both' ? 'right' : 'both')}
              title={layout === 'both' ? 'Alla grenar åt höger' : 'Grenar åt båda hållen'}
              aria-pressed={layout === 'both'}
            >
              <ArrowLeftRight size={13} />
            </button>
            <button type="button" className="ws-mindmap__tool" onClick={onUndo} title="Ångra (Ctrl+Z)">
              <Undo2 size={13} />
            </button>
            <button type="button" className="ws-mindmap__tool" onClick={onRedo} title="Gör om (Ctrl+Shift+Z)">
              <Redo2 size={13} />
            </button>
          </>
        )}
        <button
          type="button"
          className="ws-mindmap__tool"
          onClick={() => toggle('export')}
          title="Kopiera eller ladda ner"
          aria-expanded={menu === 'export'}
        >
          <Copy size={13} />
        </button>
        {!isLocked && (
          <button
            type="button"
            className="ws-mindmap__tool"
            onClick={() => toggle('help')}
            title="Kortkommandon"
            aria-expanded={menu === 'help'}
          >
            <Keyboard size={13} />
          </button>
        )}
      </div>

      {menu === 'color' && (
        <div className="ws-mindmap__popover ws-mindmap__swatches" data-export="omit" onPointerDown={stop}>
          {MINDMAP_COLORS.map((color, index) => (
            <button
              key={color}
              type="button"
              className={`ws-mindmap__swatch ws-mindmap__swatch--${color}`}
              onClick={() => onColor(color)}
              title={`${MINDMAP_COLOR_LABELS[color]} (Alt+${index + 1})`}
            />
          ))}
          <button
            type="button"
            className="ws-mindmap__swatch ws-mindmap__swatch--none"
            onClick={() => onColor(null)}
            title="Ingen färg (Alt+0)"
          >
            <X size={10} />
          </button>
        </div>
      )}

      {menu === 'export' && (
        <div className="ws-mindmap__popover ws-mindmap__menu" data-export="omit" onPointerDown={stop}>
          {canCopyImage && (
            <button type="button" className="ws-mindmap__menu-item" onClick={() => choose('image')}>
              Kopiera som bild
            </button>
          )}
          <button type="button" className="ws-mindmap__menu-item" onClick={() => choose('list')}>
            Kopiera som punktlista
          </button>
          <button type="button" className="ws-mindmap__menu-item" onClick={() => choose('headings')}>
            Kopiera som rubriker och punkter
          </button>
          <button type="button" className="ws-mindmap__menu-item" onClick={() => choose('png')}>
            Ladda ner som PNG
          </button>
          <p className="ws-mindmap__menu-hint">Klistra in i Google Docs med Ctrl+V.</p>
        </div>
      )}

      {menu === 'help' && (
        <div className="ws-mindmap__help" data-export="omit" onPointerDown={stop}>
          <button type="button" className="ws-mindmap__help-close ws-editor-icon-btn" onClick={() => onMenu(null)} title="Stäng">
            <X size={12} />
          </button>
          {MINDMAP_SHORTCUTS.map((group) => (
            <section key={group.group}>
              <h4 className="ws-mindmap__help-group">{group.group}</h4>
              <dl className="ws-mindmap__help-list">
                {group.items.map((item) => (
                  <div key={item.keys + item.what} className="ws-mindmap__help-row">
                    <dt><kbd>{item.keys}</kbd></dt>
                    <dd>{item.what}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
