import React from 'react';
import type { Activity, FamilyMember } from '../types';

interface HoverCardProps {
  activity: Activity;
  familyMembers: FamilyMember[];
  positionClasses: string;
  isVisible: boolean;
}

export const HoverCard: React.FC<HoverCardProps> = ({ activity, familyMembers, positionClasses, isVisible }) => {
  const participants = activity.participants
    .map(id => familyMembers.find(m => m.id === id))
    .filter(Boolean) as FamilyMember[];

  const visibilityClass = isVisible ? 'visible' : '';

  return (
    <div className={`hover-card ${positionClasses} ${visibilityClass}`}>
      <div className="hover-card-header">
        <span className="hover-card-icon">{activity.icon}</span>
        <h3 className="hover-card-title">{activity.name}</h3>
      </div>
      <div className="hover-card-body">
        <p><strong>Tid:</strong> {activity.startTime} – {activity.endTime}</p>
        {activity.location && <p><strong>Plats:</strong> {activity.location}</p>}
        {participants.length > 0 && (
          <div className="hover-card-participants">
            <strong>Deltagare:</strong>
            <div className="participants-list">
              {participants.map(p => (
                <span key={p.id} className="participant-badge">
                  {p.icon} {p.name}
                </span>
              ))}
            </div>
          </div>
        )}
        {activity.notes && <p className="hover-card-notes"><strong>Anteckningar:</strong> {activity.notes}</p>}
      </div>
    </div>
  );
};