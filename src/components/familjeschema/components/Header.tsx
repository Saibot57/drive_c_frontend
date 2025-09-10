import React from 'react';
import { Plus, Settings, ArrowRightLeft } from 'lucide-react';
import { formatWeekRange } from '../utils/dateUtils';

interface HeaderProps {
  selectedWeek: number;
  selectedYear: number;
  weekDates: Date[];
  onNewActivity: () => void;
  onOpenDataModal: () => void;
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  selectedWeek,
  selectedYear,
  weekDates,
  onNewActivity,
  onOpenDataModal,
  onOpenSettings
}) => {
  return (
    <header className="header">
      <div className="header-title">
        <h1>Familjens Schema</h1>
        <span className="week-info">
          Vecka {selectedWeek} • {formatWeekRange(weekDates)} {selectedYear}
        </span>
      </div>

      <div className="btn-group">
        <button
          className="btn btn-primary"
          onClick={onNewActivity}
          aria-label="Skapa ny aktivitet"
        >
          <Plus size={20} /> Ny Aktivitet
        </button>
        <button
          className="btn btn-warning"
          onClick={onOpenDataModal}
          aria-label="Importera eller exportera"
        >
          <ArrowRightLeft size={20} /> Import / Export
        </button>
        <button
          className="btn btn-warning"
          onClick={onOpenSettings}
          aria-label="Öppna inställningar"
        >
          <Settings size={20} /> Inställningar
        </button>
      </div>
    </header>
  );
};