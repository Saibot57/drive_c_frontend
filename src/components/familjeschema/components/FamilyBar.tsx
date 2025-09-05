import React from 'react';
import type { FamilyMember } from '../types';
import { Grid3x3, Layers } from 'lucide-react';

interface FamilyBarProps {
  members: FamilyMember[];
  viewMode: 'grid' | 'layer';
  onSetViewMode: (mode: 'grid' | 'layer') => void;
  onMemberClick: (memberId: string) => void;
}

export const FamilyBar: React.FC<FamilyBarProps> = ({ members, viewMode, onSetViewMode, onMemberClick }) => {
  return (
    <div className="family-bar" role="region" aria-label="Familjemedlemmar och vyer">
      <div className="family-members">
        {members.map(member => (
          <button
            key={member.id}
            className="member-badge"
            onClick={() => onMemberClick(member.id)}
            aria-label={`Visa ${member.name}s schema i lagervy`}
            title={`Visa ${member.name}s schema i lagervy`}
          >
            <span role="img" aria-hidden="true">{member.icon}</span>
            <span className="member-dot" style={{ background: member.color }}></span>
            <span>{member.name}</span>
          </button>
        ))}
      </div>

      <div className="view-mode-toggle">
        <button
          className={`view-mode-btn ${viewMode === 'grid' ? 'active' : ''}`}
          onClick={() => onSetViewMode('grid')}
          aria-label="Rutnätsvy"
          title="Visa veckoschema i rutnät"
        >
          <Grid3x3 size={20} />
          Rutnätsvy
        </button>
        <button
          className={`view-mode-btn ${viewMode === 'layer' ? 'active' : ''}`}
          onClick={() => onSetViewMode('layer')}
          aria-label="Lagervy"
          title="Visa schema uppdelat per familjemedlem"
        >
          <Layers size={20} />
          Lagervy
        </button>
      </div>
    </div>
  );
};