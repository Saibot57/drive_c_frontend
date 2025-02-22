// src/components/calendar/EventCard.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { EventCardProps } from './types';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Clock, Edit2, Trash2, X, Check } from "lucide-react";

export const EventCard: React.FC<EventCardProps> = ({
  event,
  isPreview = false,
  onEdit,
  onDelete,
  onUpdate
}) => {
  // IMPORTANT: State directly derived from event prop
  const isEditing = event.isEditing || false;
  const [editedEvent, setEditedEvent] = useState(event);
  const cardRef = useRef<HTMLDivElement>(null);
  
  console.log(`EventCard rendering with event:`, event.title, "isEditing:", event.isEditing, "Local isEditing:", isEditing);
  
  // Update local state when the event prop changes
  useEffect(() => {
    console.log("EventCard received updated event:", event.title, "isEditing:", event.isEditing);
    setEditedEvent(event);
  }, [event]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { 
      hour: '2-digit',
      minute: '2-digit',
      hour12: false 
    });
  };

  const handleSave = () => {
    console.log("Saving edited event:", editedEvent);
    if (onUpdate) {
      // Remove isEditing flag when saving
      const updatedEvent = { ...editedEvent };
      delete updatedEvent.isEditing;
      onUpdate(event.id, updatedEvent);
    }
  };

  const handleCancel = () => {
    console.log("Cancelling edit for event:", event.id);
    
    // Also notify parent to remove isEditing flag
    if (onUpdate) {
      onUpdate(event.id, { isEditing: false });
    }
  };

  // Edit mode - Directly check event.isEditing
  if (isEditing) {
    console.log("RENDERING EDIT DIALOG FOR:", event.title);
    const colorOptions = [
      '#ff6b6b', // Default pink
      '#4CAF50', // Green
      '#2196F3', // Blue
      '#FF9800', // Orange  
      '#9C27B0', // Purple
      '#607D8B'  // Blue Gray
    ];

    return (
      <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center">
        <div 
          className="w-full max-w-lg bg-white rounded-xl border-2 border-black shadow-neo"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-6 border-b-2 border-black"
               style={{ backgroundColor: editedEvent.color || '#ff6b6b' }}>
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
                onClick={handleCancel}
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
              onClick={handleCancel}
              variant="neutral"
              className="border-2 border-black bg-white hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="border-2 border-black bg-[#ff6b6b] text-white hover:bg-[#ff6b6b]/90"
            >
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Preview mode (compact card in calendar view)
  if (isPreview) {
    return (
      <div 
        ref={cardRef}
        className="cursor-pointer rounded border-2 border-black p-1 text-xs transition-all hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] group relative"
        style={{ backgroundColor: event.color || '#ff6b6b' }}
        onClick={() => onEdit && onEdit(event.id)}
      >
        <div className="flex items-center justify-between text-white">
          <span className="truncate pr-6">{event.title}</span>
          <span className="text-[10px] opacity-80">
            {formatTime(event.start)}
          </span>
        </div>
        
        {/* Edit button that appears on hover - larger and more clickable */}
        <button
          className="absolute right-1 top-1 bg-white text-black rounded-full h-5 w-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-30"
          onClick={(e) => {
            e.stopPropagation();
            if (onUpdate) {
              console.log("EventCard: Edit button clicked for event:", event.id);
              onUpdate(event.id, { isEditing: true });
            }
          }}
          aria-label="Edit event"
        >
          <Edit2 className="h-3 w-3" />
        </button>
      </div>
    );
  }

  // Default display (non-preview, non-editing)
  return (
    <div 
      className="calendar-event-card cursor-pointer"
      style={{ backgroundColor: event.color || '#ff6b6b' }}
    >
      <div className="flex items-center justify-between text-white">
        <span className="truncate">{event.title}</span>
        <span className="text-[10px] opacity-80">
          {formatTime(event.start)} - {formatTime(event.end)}
        </span>
      </div>
    </div>
  );
};