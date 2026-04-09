'use client';

import {
  Type,
  Table2,
  GitBranchPlus,
  List,
  Kanban,
  StickyNote,
  FileText,
  ArrowRightToLine,
  ArrowLeftToLine,
  PanelRightClose,
} from 'lucide-react';
import type {
  SurfaceElement,
  WorkspaceElement,
  ElementType,
} from '../types/workspace.types';

interface RightSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  placements: SurfaceElement[];
  elements: Record<string, WorkspaceElement>;
  selectedElementId: string | null;
  onSelectElement: (elementId: string) => void;
  onMoveToStorage: (placementId: string) => void;
  onMoveToCanvas: (placementId: string) => void;
}

const typeIcons: Record<ElementType, React.ReactNode> = {
  text: <Type size={14} />,
  table: <Table2 size={14} />,
  mindmap: <GitBranchPlus size={14} />,
  list: <List size={14} />,
  kanban: <Kanban size={14} />,
  sticky: <StickyNote size={14} />,
  pdf: <FileText size={14} />,
};

export default function RightSidebar({
  isOpen,
  onToggle,
  placements,
  elements,
  selectedElementId,
  onSelectElement,
  onMoveToStorage,
  onMoveToCanvas,
}: RightSidebarProps) {
  if (!isOpen) return null;

  const onCanvas = placements.filter((p) => p.is_on_canvas);
  const inStorage = placements.filter((p) => !p.is_on_canvas);

  return (
    <div className="ws-sidebar ws-sidebar-right" style={{ width: '14rem' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.5rem 0.75rem',
        }}
      >
        <span className="ws-sidebar-header" style={{ padding: 0, margin: 0 }}>
          Element
        </span>
        <button className="ws-toggle-btn" onClick={onToggle} title="Stäng sidebar">
          <PanelRightClose size={14} />
        </button>
      </div>

      {/* On canvas */}
      <div className="ws-sidebar-section">
        <div className="ws-sidebar-header">På canvas</div>
        {onCanvas.length === 0 && (
          <p style={{ fontSize: '0.75rem', color: '#9ca3af', padding: '0 0.5rem' }}>
            Inga element
          </p>
        )}
        {onCanvas.map((p) => {
          const el = elements[p.element_id];
          if (!el) return null;
          return (
            <div
              key={p.id}
              className={`ws-element-card ${el.id === selectedElementId ? 'bg-blue-50' : ''}`}
              onClick={() => onSelectElement(el.id)}
            >
              {typeIcons[el.type]}
              <span className="ws-element-card__title">{el.title}</span>
              <button
                className="ws-toggle-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveToStorage(p.id);
                }}
                title="Flytta till förråd"
              >
                <ArrowRightToLine size={12} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="ws-divider" />

      {/* In storage */}
      <div className="ws-sidebar-section">
        <div className="ws-sidebar-header">I förråd</div>
        {inStorage.length === 0 && (
          <p style={{ fontSize: '0.75rem', color: '#9ca3af', padding: '0 0.5rem' }}>
            Tomt
          </p>
        )}
        {inStorage.map((p) => {
          const el = elements[p.element_id];
          if (!el) return null;
          return (
            <div key={p.id} className="ws-element-card">
              {typeIcons[el.type]}
              <span className="ws-element-card__title">{el.title}</span>
              <button
                className="ws-toggle-btn"
                onClick={() => onMoveToCanvas(p.id)}
                title="Lägg på canvas"
              >
                <ArrowLeftToLine size={12} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
