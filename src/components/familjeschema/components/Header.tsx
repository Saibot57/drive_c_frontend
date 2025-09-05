import React from 'react';
import { Plus, Settings } from 'lucide-react';
import { formatWeekRange } from '../utils/dateUtils';

interface HeaderProps {
  selectedWeek: number;
  selectedYear: number;
  weekDates: Date[];
  onNewActivity: () => void;
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  selectedWeek,
  selectedYear,
  weekDates,
  onNewActivity,
  onOpenSettings
}) => {
  return (
    <div className="header">
      <div className="header-top">
        <div className="logo-section">
          <div className="logo-icon">📅</div>
          <div>
            <h1>Familjens Schema</h1>
            <div className="week-info">
              Vecka {selectedWeek} • {formatWeekRange(weekDates)} {selectedYear}
            </div>
          </div>
        </div>

        <div className="btn-group">
          <button 
            className="btn btn-primary" 
            onClick={onNewActivity}
            aria-label="Skapa ny aktivitet"
          >
            <Plus size={20}/> Ny Aktivitet
          </button>
          <button 
            className="btn btn-warning" 
            onClick={onOpenSettings}
            aria-label="Öppna inställningar"
          >
            <Settings size={20}/> Inställningar
          </button>
        </div>
      </div>
    </div>
  );
};