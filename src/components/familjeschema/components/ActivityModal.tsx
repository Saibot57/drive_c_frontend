import { forwardRef, useState } from 'react';
import { X, Save, Trash2, Repeat } from 'lucide-react';
import type { FormData, FamilyMember } from '../types';
import { SizableModal } from './SizableModal';
import { ACTIVITY_COLORS } from '../constants';
import { IconPicker } from './IconPicker';

interface ActivityModalProps {
  isOpen: boolean;
  isEditing: boolean;
  formData: FormData;
  familyMembers: FamilyMember[];
  days: string[];
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
  onFormChange: (data: FormData) => void;
}

export const ActivityModal = forwardRef<HTMLDivElement, ActivityModalProps>(
  ({ isOpen, isEditing, formData, familyMembers, days, onClose, onSave, onDelete, onFormChange }, ref) => {
    const [showIconPicker, setShowIconPicker] = useState(false);

    const handleDayToggle = (day: string) => {
      if (isEditing) return;
      const newDays = formData.days.includes(day)
        ? formData.days.filter(d => d !== day)
        : [...formData.days, day];
      onFormChange({ ...formData, days: newDays });
    };

    const handleParticipantToggle = (participantId: string) => {
      const newParticipants = formData.participants.includes(participantId)
        ? formData.participants.filter(p => p !== participantId)
        : [...formData.participants, participantId];
      onFormChange({ ...formData, participants: newParticipants });
    };

    return (
      <SizableModal
        isOpen={isOpen}
        onClose={onClose}
        storageKey="activity-modal"
        initialSize="medium"
        ref={ref}
      >
        <div className="modal-header">
          <h2 id="modal-title" className="modal-title">
            {isEditing ? 'Redigera Aktivitet' : 'Ny Aktivitet'}
          </h2>
          <button
            className="modal-close"
            onClick={onClose}
            aria-label="Stäng modal"
          >
            <X size={24}/>
          </button>
        </div>

        <div className="modal-body">
          {/* Name & Icon */}
          <div className="form-group">
            <label htmlFor="activity-name" className="form-label">Aktivitetsnamn *</label>
            <div style={{ display: 'flex', gap: '10px', position: 'relative' }}>
              <button
                className="btn-icon"
                onClick={() => setShowIconPicker(!showIconPicker)}
                aria-label="Välj ikon"
                style={{ fontSize: '1.5rem', width: '60px', height: 'auto' }}
              >
                {formData.icon}
              </button>
              <input
                id="activity-name"
                type="text"
                className="form-input"
                placeholder="T.ex. Fotboll"
                value={formData.name}
                onChange={e => onFormChange({ ...formData, name: e.target.value })}
                aria-label="Aktivitetsnamn"
                aria-required="true"
              />
              {showIconPicker && (
                <IconPicker
                  onSelect={(icon) => onFormChange({ ...formData, icon })}
                  onClose={() => setShowIconPicker(false)}
                />
              )}
            </div>
          </div>

          {/* Days */}
          <div className="form-group">
            <label className="form-label">Välj Dagar *</label>
            <div
              className="day-selector"
              style={{ gridTemplateColumns: `repeat(${days.length <= 3 ? days.length : 3}, 1fr)` }}
              role="group"
              aria-label="Välj veckodagar"
            >
              {days.map(day => (
                <div
                  key={day}
                  className={`day-checkbox ${formData.days.includes(day) ? 'selected' : ''} ${isEditing ? 'disabled' : ''}`}
                  onClick={() => handleDayToggle(day)}
                  role="checkbox"
                  aria-checked={formData.days.includes(day)}
                  tabIndex={isEditing ? -1 : 0}
                  onKeyDown={(e) => {
                    if (!isEditing && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      handleDayToggle(day);
                    }
                  }}
                >
                  {day.substring(0, 3).toUpperCase()}
                </div>
              ))}
            </div>
          </div>

          {/* Participants */}
          <div className="form-group">
            <label className="form-label">Deltagare *</label>
            <div className="participants-grid" role="group" aria-label="Välj deltagare">
              {familyMembers.map(member => (
                <div
                  key={member.id}
                  className={`participant-option ${formData.participants.includes(member.id) ? 'selected' : ''}`}
                  onClick={() => handleParticipantToggle(member.id)}
                  role="checkbox"
                  aria-checked={formData.participants.includes(member.id)}
                  aria-label={member.name}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleParticipantToggle(member.id);
                    }
                  }}
                >
                  <span>{member.icon}</span>
                  <span>{member.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Time */}
          <div className="form-group">
            <label className="form-label">Tid *</label>
            <div className="time-inputs">
              <input
                type="time"
                className="form-input"
                value={formData.startTime}
                onChange={e => onFormChange({ ...formData, startTime: e.target.value })}
                aria-label="Starttid"
                aria-required="true"
              />
              <input
                type="time"
                className="form-input"
                value={formData.endTime}
                onChange={e => onFormChange({ ...formData, endTime: e.target.value })}
                aria-label="Sluttid"
                aria-required="true"
              />
            </div>
          </div>

          {/* Location */}
          <div className="form-group">
            <label htmlFor="activity-location" className="form-label">Plats</label>
            <input
              id="activity-location"
              type="text"
              className="form-input"
              placeholder="T.ex. Sporthallen"
              value={formData.location}
              onChange={e => onFormChange({ ...formData, location: e.target.value })}
            />
          </div>

          {/* Notes */}
          <div className="form-group">
            <label htmlFor="activity-notes" className="form-label">Anteckningar</label>
            <textarea
              id="activity-notes"
              rows={3}
              className="form-textarea"
              placeholder="Ytterligare information..."
              value={formData.notes}
              onChange={e => onFormChange({ ...formData, notes: e.target.value })}
            />
          </div>

          {/* Color Picker */}
          <div className="form-group">
            <label htmlFor="activity-color" className="form-label">
              Egen Färg (valfritt)
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                id="activity-color"
                type="color"
                className="form-input"
                style={{ padding: '0', height: '45px', width: '60px' }}
                value={formData.color || '#ffffff'}
                onChange={(e) =>
                  onFormChange({ ...formData, color: e.target.value })
                }
                aria-label="Välj egen färg"
              />
              <input
                 type="text"
                 className="form-input"
                 placeholder="T.ex. #FFD93D"
                 value={formData.color || ''}
                 onChange={(e) => onFormChange({ ...formData, color: e.target.value })}
              />
              <button
                className="btn"
                onClick={() => onFormChange({ ...formData, color: undefined })}
                aria-label="Återställ till standardfärg"
              >
                Auto
              </button>
            </div>
            <div style={{ display: 'flex', gap: '5px', marginTop: '10px', flexWrap: 'wrap' }}>
                {ACTIVITY_COLORS.map(color => (
                    <div
                        key={color}
                        style={{
                            width: '30px',
                            height: '30px',
                            backgroundColor: color,
                            border: '2px solid var(--neo-black)',
                            cursor: 'pointer'
                        }}
                        onClick={() => onFormChange({ ...formData, color })}
                    />
                ))}
            </div>
          </div>

          {/* Recurring */}
          {!isEditing && (
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  className="checkbox-input"
                  checked={formData.recurring}
                  onChange={e => onFormChange({ ...formData, recurring: e.target.checked })}
                  aria-label="Återkommande aktivitet"
                />
                <Repeat size={20}/> Återkommande aktivitet
              </label>
              {formData.recurring && (
                <div className="recurring-section">
                  <label htmlFor="recurring-end" className="form-label">Upprepa till och med</label>
                  <input
                    id="recurring-end"
                    type="date"
                    className="form-input"
                    value={formData.recurringEndDate}
                    onChange={e => onFormChange({ ...formData, recurringEndDate: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          {isEditing && (
            <button
              className="btn btn-danger"
              onClick={onDelete}
              aria-label="Ta bort aktivitet"
            >
              <Trash2 size={20}/> Ta bort
            </button>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '15px' }}>
            <button className="btn" onClick={onClose}>Avbryt</button>
            <button
              className="btn btn-success"
              onClick={onSave}
              aria-label="Spara aktivitet"
            >
              <Save size={20}/> Spara
            </button>
          </div>
        </div>
      </SizableModal>
    );
  }
);

ActivityModal.displayName = 'ActivityModal';