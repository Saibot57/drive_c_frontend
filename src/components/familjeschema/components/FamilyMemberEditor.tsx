import React, { useState } from 'react';
import { ACTIVITY_COLORS } from '../constants';
import type { FamilyMember } from '../types';
import { IconPicker } from './IconPicker';

interface FamilyMemberEditorProps {
  member?: FamilyMember;
  existingNames: string[];
  onSave: (member: { name: string; color: string; icon: string }) => void | Promise<void>;
  onCancel: () => void;
}

export const FamilyMemberEditor: React.FC<FamilyMemberEditorProps> = ({
  member,
  existingNames,
  onSave,
  onCancel,
}) => {
  const [name, setName] = useState(member?.name || '');
  const [color, setColor] = useState(member?.color || ACTIVITY_COLORS[0]);
  const [icon, setIcon] = useState(member?.icon || '👤');
  const [showPicker, setShowPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Namn krävs');
      return;
    }
    if (existingNames.includes(name) && name !== member?.name) {
      setError('Namnet finns redan');
      return;
    }
    if (!color) {
      setError('Välj en färg');
      return;
    }
    setError(null);
    setSaving(true);
    await onSave({ name: name.trim(), color, icon });
    setSaving(false);
  };

  return (
    <form className="member-editor-form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label className="form-label">Namn</label>
        <input
          className="form-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        {error && <p className="form-error">{error}</p>}
      </div>

      <div className="form-group">
        <label className="form-label">Färg</label>
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
          {ACTIVITY_COLORS.map((c) => (
            <button
              type="button"
              key={c}
              style={{
                background: c,
                width: '24px',
                height: '24px',
                border: '2px solid var(--neo-black)',
                cursor: 'pointer',
              }}
              onClick={() => setColor(c)}
            />
          ))}
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
          />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Ikon</label>
        <button
          type="button"
          className="btn"
          onClick={() => setShowPicker(true)}
        >
          {icon}
        </button>
        {showPicker && (
          <IconPicker
            onSelect={(i) => setIcon(i)}
            onClose={() => setShowPicker(false)}
          />
        )}
      </div>

      <div className="member-actions" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn" onClick={onCancel}>
          Avbryt
        </button>
        <button type="submit" className="btn btn-success" disabled={saving}>
          {saving ? 'Sparar...' : 'Spara'}
        </button>
      </div>
    </form>
  );
};
