// src/components/WeekNavigation.tsx

import React from 'react';
import { ChevronLeft, ChevronRight, Calendar, Home, ArrowRightLeft } from 'lucide-react';

interface WeekNavigationProps {
  isCurrentWeek: boolean;
  onNavigateWeek: (direction: number) => void;
  onGoToCurrentWeek: () => void;
  onToggleWeekPicker: () => void;
  onOpenDataModal: () => void;
}

export const WeekNavigation: React.FC<WeekNavigationProps> = ({
  isCurrentWeek,
  onNavigateWeek,
  onGoToCurrentWeek,
  onToggleWeekPicker,
  onOpenDataModal
}) => {
  return (
    <nav className="week-nav" aria-label="Veckonavigering">
      <div className="week-nav-content">
        <div className="btn-group">
          <button
            className="btn btn-icon"
            onClick={() => onNavigateWeek(-1)}
            aria-label="Föregående vecka"
          >
            <ChevronLeft size={24}/>
          </button>
          <button
            className={`btn ${isCurrentWeek ? 'btn-success' : ''}`}
            onClick={onGoToCurrentWeek}
            disabled={isCurrentWeek}
            aria-label="Gå till nuvarande vecka"
          >
            <Home size={20}/> Denna Vecka
          </button>
          <button
            className="btn btn-icon"
            onClick={() => onNavigateWeek(1)}
            aria-label="Nästa vecka"
          >
            <ChevronRight size={24}/>
          </button>
          <button
            className="btn btn-info"
            onClick={onToggleWeekPicker}
            aria-label="Öppna veckoväljare"
          >
            <Calendar size={20}/> Välj Vecka
          </button>
        </div>

        <div className="btn-group">
           <button
            className="btn btn-warning"
            onClick={onOpenDataModal}
           >
            <ArrowRightLeft size={20} /> Import / Export
          </button>
        </div>
      </div>
    </nav>
  );
};