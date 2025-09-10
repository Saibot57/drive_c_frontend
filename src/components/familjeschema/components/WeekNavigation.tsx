// src/components/WeekNavigation.tsx

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface WeekNavigationProps {
  selectedWeek: number;
  isCurrentWeek: boolean;
  onNavigateWeek: (direction: number) => void;
  onGoToCurrentWeek: () => void;
  onToggleWeekPicker: () => void;
}

export const WeekNavigation: React.FC<WeekNavigationProps> = ({
  selectedWeek,
  isCurrentWeek,
  onNavigateWeek,
  onGoToCurrentWeek,
  onToggleWeekPicker
}) => {
  return (
    <nav className="week-nav" aria-label="Veckonavigering">
      <div className="week-nav-content">
        <div className="week-control">
          <button
            className="btn btn-icon"
            onClick={() => onNavigateWeek(-1)}
            aria-label="Föregående vecka"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            className="week-display"
            onClick={onToggleWeekPicker}
            aria-label="Öppna veckoväljare"
          >
            Vecka {selectedWeek}
          </button>
          <button
            className="btn btn-icon"
            onClick={() => onNavigateWeek(1)}
            aria-label="Nästa vecka"
          >
            <ChevronRight size={20} />
          </button>
        </div>
        <button
          className="btn btn-link"
          onClick={onGoToCurrentWeek}
          disabled={isCurrentWeek}
          aria-label="Gå till nuvarande vecka"
        >
          Denna vecka
        </button>
      </div>
    </nav>
  );
};