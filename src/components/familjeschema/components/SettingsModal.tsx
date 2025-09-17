import { forwardRef, useState } from 'react';
import { X, Save, Plus } from 'lucide-react';
import type { Settings, FamilyMember, Activity } from '../types';
import { SizableModal } from './SizableModal';
import { FamilyMemberEditor } from './FamilyMemberEditor';
import { FamilyMembersList } from './FamilyMembersList';

interface SettingsModalProps {
  isOpen: boolean;
  settings: Settings;
  familyMembers: FamilyMember[];
  activities: Activity[];
  memberFormOpen: boolean;
  editingMember: FamilyMember | null;
  onClose: () => void;
  onSettingsChange: (settings: Settings) => void;
  onEditMember: (member: FamilyMember | null) => void;
  onSaveMember: (member: { name: string; color: string; icon: string }) => void;
  onDeleteMember: (member: FamilyMember) => void;
  onCloseMemberForm: () => void;
}

export const SettingsModal = forwardRef<HTMLDivElement, SettingsModalProps>(
  (
    {
      isOpen,
      settings,
      familyMembers,
      activities,
      memberFormOpen,
      editingMember,
      onClose,
      onSettingsChange,
      onEditMember,
      onSaveMember,
      onDeleteMember,
      onCloseMemberForm,
    },
    ref
  ) => {
    const [activeTab, setActiveTab] = useState<'settings' | 'members'>('settings');

    const handleSaveSettings = () => {
      onClose();
    };

    return (
      <SizableModal
        isOpen={isOpen}
        onClose={onClose}
        storageKey="settings-modal"
        initialSize="full"
        forcedSize="full"
        ref={ref}
      >
        <div className="modal-header">
          <h2 id="settings-title" className="modal-title">
            Inställningar
          </h2>
          <button
            className="modal-close"
            onClick={onClose}
            aria-label="Stäng inställningar"
          >
            <X size={24} />
          </button>
        </div>

        <div className="data-modal-tabs">
          <button
            className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            Schema
          </button>
          <button
            className={`tab-btn ${activeTab === 'members' ? 'active' : ''}`}
            onClick={() => setActiveTab('members')}
          >
            Familjemedlemmar
          </button>
        </div>

        <div className="modal-body">
          {activeTab === 'settings' && (
            <>
              {/* Weekends */}
              <div className="form-group">
                <label className="form-label">Arbetsdagar</label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    className="checkbox-input"
                    checked={settings.showWeekends}
                    onChange={(e) =>
                      onSettingsChange({
                        ...settings,
                        showWeekends: e.target.checked,
                      })
                    }
                    aria-label="Inkludera helger"
                  />
                  Inkludera lör/sön
                </label>
              </div>

              {/* Hour range */}
              <div className="form-group">
                <label className="form-label">Tidsintervall (start–slut)</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="number"
                    className="form-input"
                    value={settings.dayStart}
                    min="0"
                    max="23"
                    onChange={(e) =>
                      onSettingsChange({
                        ...settings,
                        dayStart: Number(e.target.value),
                      })
                    }
                    aria-label="Starttimme"
                  />
                  <input
                    type="number"
                    className="form-input"
                    value={settings.dayEnd}
                    min={settings.dayStart + 1}
                    max="23"
                    onChange={(e) =>
                      onSettingsChange({
                        ...settings,
                        dayEnd: Number(e.target.value),
                      })
                    }
                    aria-label="Sluttimme"
                  />
                </div>
              </div>
            </>
          )}

          {activeTab === 'members' && (
            <>
              {memberFormOpen ? (
                <FamilyMemberEditor
                  member={editingMember || undefined}
                  existingNames={familyMembers.map((m) => m.name)}
                  onSave={onSaveMember}
                  onCancel={onCloseMemberForm}
                />
              ) : (
                <>
                  <FamilyMembersList
                    members={familyMembers}
                    activities={activities}
                    onEdit={(m) => onEditMember(m)}
                    onDelete={(m) => onDeleteMember(m)}
                  />
                  <div style={{ marginTop: '15px', textAlign: 'right' }}>
                    <button
                      className="btn btn-primary"
                      onClick={() => onEditMember(null)}
                    >
                      <Plus size={18} /> Lägg till medlem
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {activeTab === 'settings' && (
          <div className="modal-footer">
            <button
              className="btn btn-success"
              onClick={handleSaveSettings}
              aria-label="Spara inställningar"
            >
              <Save size={20} /> Spara
            </button>
          </div>
        )}
      </SizableModal>
    );
  }
);

SettingsModal.displayName = 'SettingsModal';
