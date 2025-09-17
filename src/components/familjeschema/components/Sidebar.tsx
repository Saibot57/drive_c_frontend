import React, { useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Home,
  Plus,
  Settings,
  ArrowRightLeft,
  Menu,
  Grid3x3,
  Layers,
  GripVertical,
  Check,
  Loader2
} from 'lucide-react';
import type { FamilyMember } from '../types';
import { Emoji } from '@/utils/Emoji';

interface SidebarProps {
  familyMembers: FamilyMember[];
  selectedWeek: number;
  selectedYear: number;
  isCurrentWeek: boolean;
  viewMode: 'grid' | 'layer';
  isReorderingMembers: boolean;
  isSavingMemberOrder: boolean;
  onNewActivity: () => void;
  onOpenSettings: () => void;
  onNavigateWeek: (direction: number) => void;
  onGoToCurrentWeek: () => void;
  onToggleWeekPicker: () => void;
  onOpenDataModal: () => void;
  onSetViewMode: (mode: 'grid' | 'layer') => void;
  onMemberClick: (memberId: string) => void;
  onStartReorder: () => void;
  onSubmitReorder: () => void;
  onReorderMembers: (sourceId: string, targetId: string | null) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  familyMembers,
  selectedWeek,
  selectedYear,
  isCurrentWeek,
  viewMode,
  isReorderingMembers,
  isSavingMemberOrder,
  onNewActivity,
  onOpenSettings,
  onNavigateWeek,
  onGoToCurrentWeek,
  onToggleWeekPicker,
  onOpenDataModal,
  onSetViewMode,
  onMemberClick,
  onStartReorder,
  onSubmitReorder,
  onReorderMembers
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [draggedMemberId, setDraggedMemberId] = useState<string | null>(null);
  const [dragOverMemberId, setDragOverMemberId] = useState<string | null>(null);
  const showLabels = !isCollapsed;
  const canReorder = familyMembers.length > 1;
  const END_TARGET_ID = '__END__';

  useEffect(() => {
    if (!isReorderingMembers) {
      setDraggedMemberId(null);
      setDragOverMemberId(null);
    }
  }, [isReorderingMembers]);

  const handleDragStart = (event: React.DragEvent<HTMLButtonElement>, memberId: string) => {
    if (!isReorderingMembers) return;
    setDraggedMemberId(memberId);
    setDragOverMemberId(memberId);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', memberId);
  };

  const handleDragOver = (event: React.DragEvent<HTMLButtonElement>, memberId: string) => {
    if (!isReorderingMembers || !draggedMemberId) return;
    event.preventDefault();
    if (draggedMemberId === memberId || dragOverMemberId === memberId) return;
    setDragOverMemberId(memberId);
    onReorderMembers(draggedMemberId, memberId);
  };

  const handleContainerDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!isReorderingMembers || !draggedMemberId) return;
    const target = event.target as HTMLElement;
    if (target.closest('.sidebar-member')) return;
    event.preventDefault();
    if (dragOverMemberId === END_TARGET_ID) return;
    setDragOverMemberId(END_TARGET_ID);
    onReorderMembers(draggedMemberId, null);
  };

  const handleDragEnd = () => {
    setDraggedMemberId(null);
    setDragOverMemberId(null);
  };

  const membersClassName = [
    'sidebar-members',
    isReorderingMembers ? 'is-reordering' : '',
    isReorderingMembers && dragOverMemberId === END_TARGET_ID ? 'drag-over-end' : ''
  ].filter(Boolean).join(' ');

  return (
    <>
      {/* Sidebar */}
      <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
        {/* Toggle Button */}
        <button 
          className="sidebar-toggle"
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-label={isCollapsed ? 'Expandera sidopanel' : 'Minimera sidopanel'}
        >
          {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>

        {/* Logo Section */}
        <div className="sidebar-logo">
          <div className="logo-icon-small">📅</div>
          {!isCollapsed && <span className="logo-text">Familjens Schema</span>}
        </div>

        {/* Week Navigation */}
        <div className="sidebar-section">
          {!isCollapsed && <h3 className="sidebar-heading">VECKA</h3>}
          <div className="sidebar-week-nav">
            <button
              className="btn-compact btn-icon-small"
              onClick={() => onNavigateWeek(-1)}
              aria-label="Föregående vecka"
              title="Föregående vecka"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="week-display" onClick={onToggleWeekPicker} title="Välj vecka">
              {isCollapsed ? (
                <span className="week-number-only">V{selectedWeek}</span>
              ) : (
                <span className="week-number">Vecka {selectedWeek}</span>
              )}
            </div>
            <button
              className="btn-compact btn-icon-small"
              onClick={() => onNavigateWeek(1)}
              aria-label="Nästa vecka"
              title="Nästa vecka"
            >
              <ChevronRight size={18} />
            </button>
          </div>
          {!isCurrentWeek && (
            <button
              className="btn-compact btn-full"
              onClick={onGoToCurrentWeek}
              title="Gå till nuvarande vecka"
            >
              <Home size={16} />
              {!isCollapsed && <span>Denna vecka</span>}
            </button>
          )}
        </div>

        {/* Family Members */}
        <div className="sidebar-section">
          <div className="sidebar-heading-row">
            {showLabels && <h3 className="sidebar-heading">FAMILJ</h3>}
            <button
              type="button"
              className={`btn-subtle ${isReorderingMembers ? 'active' : ''}`}
              onClick={isReorderingMembers ? onSubmitReorder : onStartReorder}
              disabled={isReorderingMembers ? isSavingMemberOrder : !canReorder}
              title={isReorderingMembers ? 'Spara ny ordning' : 'Ändra ordning'}
              aria-label={isReorderingMembers ? 'Spara ny ordning' : 'Aktivera omordning'}
            >
              {isReorderingMembers ? (
                <>
                  {isSavingMemberOrder ? (
                    <Loader2 size={16} className="icon-spin" />
                  ) : (
                    <Check size={16} />
                  )}
                  {showLabels && <span>{isSavingMemberOrder ? 'Sparar...' : 'Spara ordning'}</span>}
                </>
              ) : (
                <>
                  <GripVertical size={16} />
                  {showLabels && <span>Ändra ordning</span>}
                </>
              )}
            </button>
          </div>
          <div
            className={membersClassName}
            onDragOver={handleContainerDragOver}
            onDrop={handleDragEnd}
          >
            {familyMembers.map(member => {
              const isDragging = draggedMemberId === member.id;
              const isDragOver =
                dragOverMemberId === member.id && draggedMemberId !== member.id;
              const memberClassName = [
                'sidebar-member',
                isReorderingMembers ? 'reordering' : '',
                isDragging ? 'dragging' : '',
                isDragOver ? 'drag-over' : '',
              ].filter(Boolean).join(' ');

              return (
                <button
                  key={member.id}
                  type="button"
                  className={memberClassName}
                  onClick={() => {
                    if (isReorderingMembers) return;
                    onMemberClick(member.id);
                  }}
                  title={member.name}
                  style={{ borderLeftColor: member.color }}
                  draggable={isReorderingMembers}
                  onDragStart={event => handleDragStart(event, member.id)}
                  onDragOver={event => handleDragOver(event, member.id)}
                  onDragEnd={handleDragEnd}
                  onDrop={handleDragEnd}
                  aria-grabbed={isReorderingMembers && isDragging}
                >
                  {isReorderingMembers && (
                    <span className="reorder-handle" aria-hidden="true">
                      <GripVertical size={14} />
                    </span>
                  )}
                  <span className="member-icon"><Emoji emoji={member.icon} /></span>
                  {showLabels && (
                    <>
                      <span className="member-name">{member.name}</span>
                      <span className="member-color-dot" style={{ background: member.color }}></span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* View Mode */}
        <div className="sidebar-section">
          {!isCollapsed && <h3 className="sidebar-heading">VY</h3>}
          <div className="view-mode-buttons">
            <button
              className={`btn-compact ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => onSetViewMode('grid')}
              title="Rutnätsvy"
            >
              <Grid3x3 size={18} />
              {!isCollapsed && <span>Rutnät</span>}
            </button>
            <button
              className={`btn-compact ${viewMode === 'layer' ? 'active' : ''}`}
              onClick={() => onSetViewMode('layer')}
              title="Lagervy"
            >
              <Layers size={18} />
              {!isCollapsed && <span>Lager</span>}
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="sidebar-section sidebar-actions">
          <button
            className="btn-compact btn-primary"
            onClick={onNewActivity}
            title="Ny aktivitet"
          >
            <Plus size={18} />
            {!isCollapsed && <span>Ny aktivitet</span>}
          </button>
          <button
            className="btn-compact"
            onClick={onOpenDataModal}
            title="Import/Export"
          >
            <ArrowRightLeft size={18} />
            {!isCollapsed && <span>Import/Export</span>}
          </button>
          <button
            className="btn-compact"
            onClick={onOpenSettings}
            title="Inställningar"
          >
            <Settings size={18} />
            {!isCollapsed && <span>Inställningar</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Menu Button */}
      <button className="mobile-menu-btn" onClick={() => setIsCollapsed(!isCollapsed)}>
        <Menu size={24} />
      </button>
    </>
  );
};