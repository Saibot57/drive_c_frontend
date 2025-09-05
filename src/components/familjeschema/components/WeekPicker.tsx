import React from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { getWeeksInYear, getWeekNumber } from '../utils/dateUtils';

interface WeekPickerProps {
  selectedWeek: number;
  selectedYear: number;
  onSelectWeek: (week: number) => void;
  onChangeYear: (year: number) => void;
  onClose: () => void;
}

export const WeekPicker: React.FC<WeekPickerProps> = ({
  selectedWeek,
  selectedYear,
  onSelectWeek,
  onChangeYear,
  onClose
}) => {
  const currentWeek = getWeekNumber(new Date());
  const currentYear = new Date().getFullYear();
  const weeksInYear = getWeeksInYear(selectedYear);

  return (
    <>
      <div
        className="modal-overlay"
        onClick={onClose}
      />
      <div
        className="week-picker"
        role="dialog"
        aria-label="Välj vecka och år"
      >
        <div className="week-picker-header">
          <h3 style={{ textTransform: 'uppercase' }}>Välj Vecka</h3>
          <div className="year-selector">
            <button
              className="btn btn-icon"
              onClick={() => onChangeYear(selectedYear - 1)}
              aria-label="Föregående år"
            >
              <ChevronLeft size={20}/>
            </button>
            <span style={{ padding: '0 15px', fontWeight: '700', fontSize: '1.2rem' }}>
              {selectedYear}
            </span>
            <button
              className="btn btn-icon"
              onClick={() => onChangeYear(selectedYear + 1)}
              aria-label="Nästa år"
            >
              <ChevronRight size={20}/>
            </button>
          </div>
          <button
            className="modal-close"
            onClick={onClose}
            aria-label="Stäng veckoväljare"
          >
            <X size={24}/>
          </button>
        </div>
        <div className="week-picker-grid">
          {[...Array(weeksInYear)].map((_, i) => {
            const week = i + 1;
            const isSelected = week === selectedWeek && selectedYear === selectedYear;
            const isCurrent = week === currentWeek && selectedYear === currentYear;

            return (
              <button
                key={week}
                className={`week-picker-btn ${isSelected ? 'selected' : ''} ${isCurrent ? 'current' : ''}`}
                onClick={() => {
                  onSelectWeek(week);
                  onClose();
                }}
                aria-label={`Vecka ${week}`}
              >
                {week}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};