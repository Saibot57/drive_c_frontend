// src/components/Calendar/types.ts
export interface Event {
    id: string;
    title: string;
    start: Date;
    end: Date;
    notes?: string;
  }
  
  export interface DayCardProps {
    date: Date;
    events: Event[];
    isFlipped: boolean;
    onFlip: () => void;
    onClose: () => void;
    onEventAdd: (event: Omit<Event, 'id'>) => void;
  }
  
  export interface EventCardProps {
    event: Event;
    isExpanded: boolean;
    onToggle: () => void;
    onClose?: () => void;
  }
  
  export interface TimeGridProps {
    events: Event[];
    onEventAdd: (event: Omit<Event, 'id'>) => void;
    date: Date;
  }