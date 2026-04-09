'use client';

import {
  Type,
  Table2,
  GitBranchPlus,
  List,
  Kanban,
  StickyNote,
  FileText,
  Layers,
  PanelLeftClose,
} from 'lucide-react';
import type { ElementType } from '../types/workspace.types';

interface LeftSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onCreateElement: (type: ElementType) => void;
  onCreateSurface: () => void;
}

const elementButtons: { type: ElementType; label: string; icon: React.ReactNode }[] = [
  { type: 'text', label: 'Text', icon: <Type size={16} /> },
  { type: 'table', label: 'Tabell', icon: <Table2 size={16} /> },
  { type: 'mindmap', label: 'Mindmap', icon: <GitBranchPlus size={16} /> },
  { type: 'list', label: 'Lista', icon: <List size={16} /> },
  { type: 'kanban', label: 'Kanban', icon: <Kanban size={16} /> },
  { type: 'sticky', label: 'Notislapp', icon: <StickyNote size={16} /> },
  { type: 'pdf', label: 'PDF', icon: <FileText size={16} /> },
];

export default function LeftSidebar({
  isOpen,
  onToggle,
  onCreateElement,
  onCreateSurface,
}: LeftSidebarProps) {
  if (!isOpen) return null;

  return (
    <div className="ws-sidebar ws-sidebar-left" style={{ width: '13rem' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.5rem 0.75rem',
        }}
      >
        <span className="ws-sidebar-header" style={{ padding: 0, margin: 0 }}>
          Skapa
        </span>
        <button className="ws-toggle-btn" onClick={onToggle} title="Stäng sidebar">
          <PanelLeftClose size={14} />
        </button>
      </div>

      <div className="ws-sidebar-section">
        <button className="ws-create-btn" onClick={onCreateSurface}>
          <Layers size={16} />
          Ny yta
        </button>
      </div>

      <div className="ws-divider" />

      <div className="ws-sidebar-section">
        {elementButtons.map((btn) => (
          <button
            key={btn.type}
            className="ws-create-btn"
            onClick={() => onCreateElement(btn.type)}
          >
            {btn.icon}
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  );
}
