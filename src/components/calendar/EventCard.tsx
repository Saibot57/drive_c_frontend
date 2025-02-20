// src/components/calendar/EventCard.tsx
'use client';

import React, { useState } from 'react';
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
  const [isEditing, setIsEditing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [editedEvent, setEditedEvent] = useState(event);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { 
      hour: '2-digit',
      minute: '2-digit',
      hour12: false 
    });
  };

  const handleSave = () => {
    if (onUpdate) {
      onUpdate(event.id, editedEvent);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedEvent(event);
    setIsEditing(false);
  };

  // Preview mode (compact card in calendar view)
  if (isPreview) {
    return (
      <div 
        onClick={() => setShowDetails(true)}
        className="calendar-event-card cursor-pointer"
      >
        <div className="flex items-center justify-between text-white">
          <span className="truncate">{event.title}</span>
          <span className="text-[10px] opacity-80">
            {formatTime(event.start)}
          </span>
        </div>
      </div>
    );
  }

  // Detailed view modal
  if (showDetails && !isEditing) {
    return (
      <div className="fixed inset-0 z-50 bg-black/20 flex items-center justify-center">
        <div 
          className="w-full max-w-lg bg-white rounded-xl border-2 border-black shadow-neo"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-6 border-b-2 border-black bg-[#ff6b6b]">
            <h2 className="font-monument text-2xl text-white">{event.title}</h2>
            <div className="flex gap-2">
              {onEdit && (
                <Button
                  onClick={() => setIsEditing(true)}
                  variant="neutral"
                  className="h-8 w-8 p-0 bg-white"
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
              )}
              {onDelete && (
                <Button
                  onClick={() => {
                    onDelete(event.id);
                    setShowDetails(false);
                  }}
                  variant="neutral"
                  className="h-8 w-8 p-0 bg-white"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <Button
                onClick={() => setShowDetails(false)}
                variant="neutral"
                className="h-8 w-8 p-0 bg-white"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4" />
              <span>
                {formatTime(event.start)} - {formatTime(event.end)}
              </span>
            </div>

            {event.notes && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border-2 border-black">
                <p className="text-sm whitespace-pre-wrap">{event.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Edit mode
  if (isEditing) {
    return (
      <div className="fixed inset-0 z-50 bg-black/20 flex items-center justify-center">
        <div 
          className="w-full max-w-lg bg-white rounded-xl border-2 border-black shadow-neo"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-6 border-b-2 border-black">
            <h2 className="font-monument text-2xl">Edit Event</h2>
            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                variant="neutral"
                className="h-8 w-8 p-0"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                onClick={handleCancel}
                variant="neutral"
                className="h-8 w-8 p-0"
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
                className="w-full"
              />
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block font-monument text-sm mb-2">Start Time</label>
                <Input
                  type="time"
                  value={formatTime(editedEvent.start)}
                  onChange={(e) => {
                    const [hours, minutes] = e.target.value.split(':');
                    const newStart = new Date(editedEvent.start);
                    newStart.setHours(parseInt(hours), parseInt(minutes));
                    setEditedEvent({
                      ...editedEvent,
                      start: newStart
                    });
                  }}
                  className="w-full"
                />
              </div>
              <div className="flex-1">
                <label className="block font-monument text-sm mb-2">End Time</label>
                <Input
                  type="time"
                  value={formatTime(editedEvent.end)}
                  onChange={(e) => {
                    const [hours, minutes] = e.target.value.split(':');
                    const newEnd = new Date(editedEvent.end);
                    newEnd.setHours(parseInt(hours), parseInt(minutes));
                    setEditedEvent({
                      ...editedEvent,
                      end: newEnd
                    });
                  }}
                  className="w-full"
                />
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
                className="w-full min-h-[100px]"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default display (non-preview, non-editing)
  return (
    <div 
      onClick={() => setShowDetails(true)}
      className="calendar-event-card cursor-pointer"
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