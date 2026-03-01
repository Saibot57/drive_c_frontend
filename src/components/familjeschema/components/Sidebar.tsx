import React, { useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Menu,
  GripVertical,
  Check,
  Loader2,
  Sparkles
} from 'lucide-react';
import type { FamilyMember } from '../types';
import { Emoji } from '@/utils/Emoji';

interface SidebarProps {
  familyMembers: FamilyMember[];
  isReorderingMembers: boolean;
  isSavingMemberOrder: boolean;
  onMemberClick: (memberId: string) => void;
  onStartReorder: () => void;
  onSubmitReorder: () => void;
  onReorderMembers: (sourceId: string, targetId: string | null) => void;
  onQuickTextImport: (jsonText: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  familyMembers,
  isReorderingMembers,
  isSavingMemberOrder,
  onMemberClick,
  onStartReorder,
  onSubmitReorder,
  onReorderMembers,
  onQuickTextImport,
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

        {/* Quick Import */}
        {!isCollapsed && (
          <div className="sidebar-section">
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
          </div>
        )}
      </aside>

      {/* Mobile Menu Button */}
      <button className="mobile-menu-btn" onClick={() => setIsCollapsed(!isCollapsed)}>
        <Menu size={24} />
      </button>
    </>
  );
};
