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
  Loader2,
  Printer,
  Sparkles
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
  onSystemPrint?: () => void;
  onQuickTextImport: (jsonText: string) => void;
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
  onReorderMembers,
  onSystemPrint,
  onQuickTextImport
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [draggedMemberId, setDraggedMemberId] = useState<string | null>(null);
  const [dragOverMemberId, setDragOverMemberId] = useState<string | null>(null);
  const [quickImportText, setQuickImportText] = useState('');
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

  const handleQuickImport = () => {
    const trimmed = quickImportText.trim();
    if (!trimmed) return;
    onQuickTextImport(trimmed);
    setQuickImportText('');
  };

  const handleQuickImportKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      handleQuickImport();
    }
  };

  const handleGeminiLinkClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const url = 'https://gemini.google.com/u/1/gem/52527d352450';
    const newWindow = window.open(url, 'familyscheduleGemini', 'width=720,height=640,noopener');
    if (newWindow) {
      newWindow.focus();
      event.preventDefault();
    }
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

        {/* Week Navigation & View Mode */}
        <div className="sidebar-section sidebar-top-controls">
          <div className="view-mode-inline">
            {showLabels && (
              <span className="sidebar-heading-inline" aria-hidden="true">VY</span>
            )}
            <div className="view-mode-buttons">
              <button
                className={`btn-square ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => onSetViewMode('grid')}
                title="Rutnätsvy"
                aria-label="Rutnätsvy"
                aria-pressed={viewMode === 'grid'}
                type="button"
              >
                <Grid3x3 size={20} />
                <span className="sr-only">Rutnätsvy</span>
              </button>
              <button
                className={`btn-square ${viewMode === 'layer' ? 'active' : ''}`}
                onClick={() => onSetViewMode('layer')}
                title="Lagervy"
                aria-label="Lagervy"
                aria-pressed={viewMode === 'layer'}
                type="button"
              >
                <Layers size={20} />
                <span className="sr-only">Lagervy</span>
              </button>
            </div>
          </div>

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

        {/* Scrollable content wrapper */}
        <div className="sidebar-scrollable-content">
          {/* Family Members */}
          <div className="sidebar-section family-members-section">
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
                    {showLabels && <span className="member-name">{member.name}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="sidebar-section sidebar-actions">
          <div className="sidebar-action-buttons">
            <button
              className="btn-square btn-square-large btn-primary"
              onClick={onNewActivity}
              title="Ny aktivitet"
              aria-label="Ny aktivitet"
              type="button"
            >
              <Plus size={20} />
              <span className="sr-only">Ny aktivitet</span>
            </button>
            <button
              className="btn-square btn-square-large"
              onClick={onOpenDataModal}
              title="Import/Export"
              aria-label="Import/Export"
              type="button"
            >
              <ArrowRightLeft size={20} />
              <span className="sr-only">Importera eller exportera</span>
            </button>
            <button
              type="button"
              className="btn-square btn-square-large"
              onClick={() => onSystemPrint?.()}
              title="Skriv ut"
              aria-label="Skriv ut"
            >
              <Printer size={20} />
              <span className="sr-only">Skriv ut</span>
            </button>
            <button
              className="btn-square btn-square-large"
              onClick={onOpenSettings}
              title="Inställningar"
              aria-label="Inställningar"
              type="button"
            >
              <Settings size={20} />
              <span className="sr-only">Inställningar</span>
            </button>
          </div>
          {!isCollapsed && (
            <div className="sidebar-quick-import" role="region" aria-label="Snabbimport av JSON">
              <label htmlFor="sidebar-quick-import" className="sr-only">
                Snabbimport av JSON-data
              </label>
              <textarea
                id="sidebar-quick-import"
                className="sidebar-quick-import-input"
                rows={3}
                placeholder="Klistra in JSON och tryck på import"
                value={quickImportText}
                onChange={(event) => setQuickImportText(event.target.value)}
                onKeyDown={handleQuickImportKeyDown}
              />
              <div className="sidebar-quick-import-actions">
                <button
                  type="button"
                  className="btn-compact btn-primary"
                  onClick={handleQuickImport}
                  disabled={!quickImportText.trim()}
                >
                  Importera JSON
                </button>
              </div>
              <a
                href="https://gemini.google.com/u/1/gem/52527d352450"
                className="sidebar-quick-import-link"
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleGeminiLinkClick}
                aria-label="Öppna Gemini-guiden i ett nytt fönster"
              >
                <Sparkles size={16} aria-hidden="true" />
              </a>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Menu Button */}
      <button className="mobile-menu-btn" onClick={() => setIsCollapsed(!isCollapsed)}>
        <Menu size={24} />
      </button>
    </>
  );
};