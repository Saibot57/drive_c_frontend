import React from 'react';
import type { FamilyMember, Activity } from '../types';
import { Emoji } from '@/utils/Emoji';

interface FamilyMembersListProps {
  members: FamilyMember[];
  activities: Activity[];
  onEdit: (member: FamilyMember) => void;
  onDelete: (member: FamilyMember) => void;
}

export const FamilyMembersList: React.FC<FamilyMembersListProps> = ({
  members,
  activities,
  onEdit,
  onDelete,
}) => {
  const getUsage = (id: string) =>
    activities.filter((a) => a.participants.includes(id)).length;

  const handleDelete = (member: FamilyMember) => {
    const count = getUsage(member.id);
    const confirmMsg =
      count > 0
        ? `Är du säker? Medlemmen används i ${count} aktiviteter.`
        : 'Är du säker på att du vill ta bort medlemmen?';
    if (window.confirm(confirmMsg)) {
      onDelete(member);
    }
  };

  return (
    <ul>
      {members.map((m) => (
        <li key={m.id} className="member-list-item">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              className="member-color-preview"
              style={{ background: m.color }}
            />
            <span>
              <Emoji emoji={m.icon} /> {m.name}
            </span>
          </div>
          <div className="member-actions">
            <span style={{ marginRight: '10px' }}>{getUsage(m.id)}</span>
            <button className="btn" onClick={() => onEdit(m)}>
              Redigera
            </button>
            <button
              className="member-delete-btn"
              onClick={() => handleDelete(m)}
            >
              Ta bort
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
};
