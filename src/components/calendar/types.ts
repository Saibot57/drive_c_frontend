// src/components/calendar/types.ts

export interface Event {
  id: string;
  title: string;
  start: Date;
  end: Date;
  notes?: string;
  color?: string;
  isEditing?: boolean;
}

export interface DayModalProps {
  date: Date;
  events: Event[];
  isOpen: boolean;
  onClose: () => void;
  onEventAdd: (event: Omit<Event, 'id'>) => void;
  onEventUpdate?: (id: string, event: Partial<Event>) => void;
  onEventDelete?: (id: string) => void;
  onSaveNotes?: (notes: string) => void;
}

export interface DayCardProps {
  date: Date;
  events: Event[];
  onClick: () => void;
}

export interface EventCardProps {
  event: Event;
  isPreview?: boolean;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onUpdate?: (id: string, updates: Partial<Event>) => void;
}

export interface TimeGridProps {
  events: Event[];
  onEventAdd: (event: Omit<Event, 'id'>) => void;
  onEventUpdate?: (id: string, updates: Partial<Event>) => void;
  date: Date;
}

export interface EventConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (eventDetails: Omit<Event, 'id'>) => void;
  startTime: Date;
  endTime: Date;
  event?: Event; // For editing existing events
}