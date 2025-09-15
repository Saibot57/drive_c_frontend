import React, { useState } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Home,
  Plus,
  Settings,
  ArrowRightLeft,
  Menu,
  X,
  Grid3x3,
  Layers
} from 'lucide-react';
import type { FamilyMember } from '../types';
import { Emoji } from '@/utils/Emoji';

interface SidebarProps {
  familyMembers: FamilyMember[];
  selectedWeek: number;
  selectedYear: number;
  isCurrentWeek: boolean;
  viewMode: 'grid' | 'layer';
  onNewActivity: () => void;
  onOpenSettings: () => void;
  onNavigateWeek: (direction: number) => void;
  onGoToCurrentWeek: () => void;
  onToggleWeekPicker: () => void;
  onOpenDataModal: () => void;
  onSetViewMode: (mode: 'grid' | 'layer') => void;
  onMemberClick: (memberId: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  familyMembers,
  selectedWeek,
  selectedYear,
  isCurrentWeek,
  viewMode,
  onNewActivity,
  onOpenSettings,
  onNavigateWeek,
  onGoToCurrentWeek,
  onToggleWeekPicker,
  onOpenDataModal,
  onSetViewMode,
  onMemberClick
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

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
          <div className="logo-icon-small">
            <Emoji emoji="📅" forceTwemoji />
          </div>
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
          {!isCollapsed && <h3 className="sidebar-heading">FAMILJ</h3>}
          <div className="sidebar-members">
            {familyMembers.map(member => (
              <button
                key={member.id}
                className="sidebar-member"
                onClick={() => onMemberClick(member.id)}
                title={member.name}
                style={{ borderLeftColor: member.color }}
              >
                <span className="member-icon"><Emoji emoji={member.icon} /></span>
                {!isCollapsed && (
                  <>
                    <span className="member-name">{member.name}</span>
                    <span className="member-color-dot" style={{ background: member.color }}></span>
                  </>
                )}
              </button>
            ))}
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