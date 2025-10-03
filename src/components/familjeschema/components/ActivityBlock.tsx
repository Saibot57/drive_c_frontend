import React, { useState, useRef, useMemo } from 'react';
import type { Activity, FamilyMember } from '../types';
import { HoverCard } from './HoverCard';
import { Emoji } from '@/utils/Emoji';

interface ActivityBlockProps {
  activity: Activity;
  familyMembers: FamilyMember[];
  style: React.CSSProperties;
  onClick: () => void;
  // day: string; <-- DENNA RAD TAS BORT
  dayIndex: number;
  totalDays: number;
}

export const ActivityBlock: React.FC<ActivityBlockProps> = ({
  activity,
  familyMembers,
  style,
  onClick,
  // day, <-- DENNA VARIABEL TAS BORT
  dayIndex,
  totalDays
}) => {
  const participants = activity.participants
    .map(id => familyMembers.find(m => m.id === id))
    .filter(Boolean) as FamilyMember[];

  const [isCardVisible, setCardVisible] = useState(false);
  const [positionClasses, setPositionClasses] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  const durationInMinutes = useMemo(() => {
    const parseTime = (time: string) => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };

    const start = parseTime(activity.startTime);
    const end = parseTime(activity.endTime);

    if (Number.isNaN(start) || Number.isNaN(end)) {
      return 0;
    }

    return Math.max(end - start, 0);
  }, [activity.startTime, activity.endTime]);

  const isLongDuration = durationInMinutes >= 120;
  const isMediumDuration = durationInMinutes >= 120 && durationInMinutes < 150;
  const shouldHideTime = isMediumDuration;

  const handleMouseEnter = () => {
    if (!wrapperRef.current) return;

    const rect = wrapperRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    
    const verticalClass = rect.top > viewportHeight / 2 ? 'position-top' : 'position-bottom';
    
    let horizontalClass = 'position-center';
    if (dayIndex === 0) {
      horizontalClass = 'position-right';
    } else if (dayIndex === totalDays - 1) {
      horizontalClass = 'position-left';
    }
    
    setPositionClasses(`${verticalClass} ${horizontalClass}`);
    setCardVisible(true);
  };

  const handleMouseLeave = () => {
    setCardVisible(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  const getBackgroundStyle = () => {
    if (activity.color) {
      return { background: activity.color };
    }
    if (participants.length === 0) {
      return { background: '#E0E0E0' };
    }
    if (participants.length === 1) {
      return { background: participants[0].color };
    }
    const participantColors = participants.map(p => p.color);
    const colorStops = participantColors.map((color, index) => {
        const start = (100 / participantColors.length) * index;
        const end = (100 / participantColors.length) * (index + 1);
        return `${color} ${start}%, ${color} ${end}%`;
    }).join(', ');

    return { background: `linear-gradient(135deg, ${colorStops})` };
  };

  const backgroundStyle = getBackgroundStyle();
  
  const height = typeof style.height === 'number' ? style.height : 0;
  const activityBlockClasses = ['activity-block'];
  if (height < 65) {
    activityBlockClasses.push('activity-block-compact');
  }
  if (height < 45) {
    activityBlockClasses.push('activity-block-extra-compact');
  }
  if (isLongDuration) {
    activityBlockClasses.push('activity-block-long');
  }

  return (
    <div
      className="activity-block-wrapper"
      style={style}
      ref={wrapperRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className={activityBlockClasses.join(' ')}
        style={{
          ...backgroundStyle,
          position: 'relative',
          width: '100%',
          height: '100%',
        }}
        onClick={onClick}
        role="button"
        tabIndex={0}
        aria-label={`${activity.name} från ${activity.startTime} till ${activity.endTime}`}
        onKeyDown={handleKeyDown}
      >
        <div className={`activity-name${isLongDuration ? ' activity-name-long' : ''}`}>
          {isLongDuration ? (
            <>
              <Emoji emoji={activity.icon} className="activity-name-icon" />
              <span className="activity-name-text">{activity.name}</span>
            </>
          ) : (
            <>
              <Emoji emoji={activity.icon} />
              {activity.name}
            </>
          )}
        </div>
        {!shouldHideTime && (
          <div className="activity-time">
            {activity.startTime} – {activity.endTime}
          </div>
        )}
        <div className={`activity-participants${isLongDuration ? ' activity-participants-long' : ''}`}>
          {participants.map(p => (
            <span key={p.id} aria-label={p.name}>
              <Emoji emoji={p.icon} />
            </span>
          ))}
        </div>
      </div>
      <HoverCard 
        activity={activity} 
        familyMembers={familyMembers} 
        positionClasses={positionClasses}
        isVisible={isCardVisible}
      />
    </div>
  );
};