// src/components/calendar/DebugButton.tsx
'use client';

import React from 'react';
import { Bug } from 'lucide-react';
import { Event } from './types';

interface DebugButtonProps {
  events: Event[];
  selectedEvent: string | null;
  editingEvent: string | null;
  onForceEdit: (eventId: string) => void;
}

export const DebugButton: React.FC<DebugButtonProps> = ({
  events,
  selectedEvent,
  editingEvent,
  onForceEdit
}) => {
  const [isOpen, setIsOpen] = React.useState(false);

  if (!isOpen) {
    return (
      <button
        className="fixed bottom-4 right-4 bg-white border-2 border-black rounded-full p-2 shadow-neo z-[200]"
        onClick={() => setIsOpen(true)}
      >
        <Bug className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white border-2 border-black rounded-xl p-4 shadow-neo z-[200] w-80">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold">Debug Panel</h3>
        <button
          className="text-black"
          onClick={() => setIsOpen(false)}
        >
          ✕
        </button>
      </div>
      
      <div className="text-xs mb-2">
        <div>Selected Event: {selectedEvent || 'none'}</div>
        <div>Editing Event: {editingEvent || 'none'}</div>
      </div>

      <div className="text-xs mb-2">
        <strong>Events:</strong>
        <div className="max-h-32 overflow-auto">
          {events.map(event => (
            <div key={event.id} className="flex items-center justify-between border-b py-1">
              <div>
                {event.title} 
                {event.isEditing && <span className="text-green-600 ml-1">(editing)</span>}
              </div>
              <button
                className="bg-blue-500 text-white px-1 py-0.5 text-[10px] rounded"
                onClick={() => {
                  console.log("Debug panel: Force edit event", event.id);
                  onForceEdit(event.id);
                }}
              >
                Force Edit
              </button>
            </div>
          ))}
        </div>
      </div>
      
      <div className="bg-gray-100 p-2 rounded text-[10px]">
        <p>Click &ldquo;Force Edit&rdquo; to directly trigger the edit dialog for an event.</p>
      </div>
    </div>
  );
};