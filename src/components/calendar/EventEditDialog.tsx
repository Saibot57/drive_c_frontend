// src/components/calendar/EventEditDialog.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { X, Check } from "lucide-react";
import { Event } from './types';

interface EventEditDialogProps {
  event: Event;
  isOpen: boolean;
  onClose: () => void;
  onSave: (eventId: string, updates: Partial<Event>) => void;
}

export const EventEditDialog: React.FC<EventEditDialogProps> = ({
  event,
  isOpen,
  onClose,
  onSave
}) => {
  const [editedEvent, setEditedEvent] = useState<Event>(event);

  useEffect(() => {
    setEditedEvent(event);
  }, [event]);

  if (!isOpen) return null;

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { 
      hour: '2-digit',
      minute: '2-digit',
      hour12: false 
    });
  };

  const colorOptions = [
    '#ff6b6b', // Default pink
    '#4CAF50', // Green
    '#2196F3', // Blue
    '#FF9800', // Orange  
    '#9C27B0', // Purple
    '#607D8B'  // Blue Gray
  ];

  const handleSave = () => {
    // Only include the fields that have been changed
    const updates: Partial<Event> = {};
    
    if (editedEvent.title !== event.title) updates.title = editedEvent.title;
    if (editedEvent.start !== event.start) updates.start = editedEvent.start;
    if (editedEvent.end !== event.end) updates.end = editedEvent.end;
    if (editedEvent.notes !== event.notes) updates.notes = editedEvent.notes;
    if (editedEvent.color !== event.color) updates.color = editedEvent.color;
    
    onSave(event.id, updates);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center">
      <div 
        className="w-full max-w-lg bg-white rounded-xl border-2 border-black shadow-neo"
        onClick={(e) => e.stopPropagation()}
      >
        <div 
          className="flex items-center justify-between p-6 border-b-2 border-black"
          style={{ backgroundColor: editedEvent.color || '#ff6b6b' }}
        >
          <h2 className="font-monument text-2xl text-white">Edit Event</h2>
          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              variant="neutral"
              className="h-8 w-8 p-0 bg-white hover:bg-gray-50"
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              onClick={onClose}
              variant="neutral"
              className="h-8 w-8 p-0 bg-white hover:bg-gray-50"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block font-monument text-sm mb-2">Event Name</label>
            <Input
              type="text"
              value={editedEvent.title}
              onChange={(e) => setEditedEvent({
                ...editedEvent,
                title: e.target.value
              })}
              className="w-full border-2 border-black"
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block font-monument text-sm mb-2">Start Time</label>
              <Input
                type="time"
                value={formatTime(editedEvent.start)}
                onChange={(e) => {
                  const [hours, minutes] = e.target.value.split(':').map(Number);
                  if (!isNaN(hours) && !isNaN(minutes)) {
                    const newStart = new Date(editedEvent.start);
                    newStart.setHours(hours, minutes);
                    setEditedEvent({
                      ...editedEvent,
                      start: newStart
                    });
                  }
                }}
                className="w-full border-2 border-black"
              />
            </div>
            <div className="flex-1">
              <label className="block font-monument text-sm mb-2">End Time</label>
              <Input
                type="time"
                value={formatTime(editedEvent.end)}
                onChange={(e) => {
                  const [hours, minutes] = e.target.value.split(':').map(Number);
                  if (!isNaN(hours) && !isNaN(minutes)) {
                    const newEnd = new Date(editedEvent.end);
                    newEnd.setHours(hours, minutes);
                    setEditedEvent({
                      ...editedEvent,
                      end: newEnd
                    });
                  }
                }}
                className="w-full border-2 border-black"
              />
            </div>
          </div>

          <div>
            <label className="block font-monument text-sm mb-2">Event Color</label>
            <div className="flex flex-wrap gap-2">
              {colorOptions.map(color => (
                <button
                  key={color}
                  type="button"
                  className={`w-8 h-8 rounded-full border-2 ${editedEvent.color === color ? 'border-black' : 'border-gray-300'}`}
                  style={{ backgroundColor: color }}
                  onClick={() => setEditedEvent({
                    ...editedEvent,
                    color: color
                  })}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block font-monument text-sm mb-2">Notes</label>
            <Textarea
              value={editedEvent.notes || ''}
              onChange={(e) => setEditedEvent({
                ...editedEvent,
                notes: e.target.value
              })}
              className="w-full min-h-[100px] border-2 border-black"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 p-6 border-t-2 border-black">
          <Button
            onClick={onClose}
            variant="neutral"
            className="border-2 border-black bg-white hover:bg-gray-50"
            type="button"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="border-2 border-black bg-[#ff6b6b] text-white hover:bg-[#ff6b6b]/90"
            type="button"
          >
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
};