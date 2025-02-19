// src/components/calendar/types.ts
export interface Event {
  id: string;
  title: string;
  start: Date;
  end: Date;
  notes?: string;
}

export interface DayModalProps {
  date: Date;
  events: Event[];
  isOpen: boolean;
  onClose: () => void;
  onEventAdd: (event: Omit<Event, 'id'>) => void;
}

export interface DayCardProps {
  date: Date;
  events: Event[];
  onClick: () => void;
}

export interface EventCardProps {
  event: Event;
  isPreview?: boolean;
}

export interface TimeGridProps {
  events: Event[];
  onEventAdd: (event: Omit<Event, 'id'>) => void;
  date: Date;
}