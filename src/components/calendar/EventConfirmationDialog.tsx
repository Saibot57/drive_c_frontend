// src/components/calendar/EventConfirmationDialog.tsx
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { X } from "lucide-react";

interface EventConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (eventDetails: {
    title: string;
    notes?: string;
    start: Date;
    end: Date;
  }) => void;
  startTime: Date;
  endTime: Date;
}

const EventConfirmationDialog: React.FC<EventConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  startTime,
  endTime,
}) => {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [start, setStart] = useState(startTime);
  const [end, setEnd] = useState(endTime);

  // Reset form when dialog opens with new times
  useEffect(() => {
    setStart(startTime);
    setEnd(endTime);
    setTitle('New Event');
    setNotes('');
  }, [startTime, endTime, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Ensure consistent time handling by creating fresh date objects
    const eventStart = new Date(start);
    const eventEnd = new Date(end);
    
    onConfirm({
      title: title || 'New Event',
      notes,
      start: eventStart,
      end: eventEnd,
    });
    
    setTitle('');
    setNotes('');
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { 
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const handleTimeChange = (field: 'start' | 'end', timeString: string) => {
    const [hours, minutes] = timeString.split(':').map(Number);
    
    if (field === 'start') {
      // Create new date object to avoid reference issues
      const newStart = new Date(start);
      // Set hours and minutes directly, keeping seconds and ms at 0
      newStart.setHours(hours, minutes, 0, 0);
      setStart(newStart);
      
      // If end time is before new start time, adjust end time
      if (end < newStart) {
        const newEnd = new Date(newStart);
        // Add one hour
        newEnd.setHours(newEnd.getHours() + 1);
        setEnd(newEnd);
      }
    } else {
      const newEnd = new Date(end);
      newEnd.setHours(hours, minutes, 0, 0);
      
      // Ensure end time is after start time
      if (newEnd > start) {
        setEnd(newEnd);
      } else {
        // If not, set end time to 1 hour after start
        const validEnd = new Date(start);
        validEnd.setHours(validEnd.getHours() + 1);
        setEnd(validEnd);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/20 flex items-center justify-center">
      <div 
        className="w-full max-w-lg bg-white rounded-xl border-2 border-black shadow-neo"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b-2 border-black bg-[#ff6b6b]">
          <h2 className="font-monument text-2xl text-white">New Event</h2>
          <Button
            onClick={onClose}
            variant="neutral"
            className="h-8 w-8 p-0 bg-white hover:bg-gray-50"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block font-monument text-sm mb-2">Event Name</label>
            <Input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter event name"
              className="w-full border-2 border-black"
              autoFocus
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block font-monument text-sm mb-2">Start Time</label>
              <Input
                type="time"
                value={formatTime(start)}
                onChange={(e) => handleTimeChange('start', e.target.value)}
                className="w-full border-2 border-black"
              />
            </div>
            <div className="flex-1">
              <label className="block font-monument text-sm mb-2">End Time</label>
              <Input
                type="time"
                value={formatTime(end)}
                onChange={(e) => handleTimeChange('end', e.target.value)}
                className="w-full border-2 border-black"
              />
            </div>
          </div>

          <div>
            <label className="block font-monument text-sm mb-2">Notes</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add event notes..."
              className="w-full border-2 border-black"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              onClick={onClose}
              variant="neutral"
              className="border-2 border-black bg-white hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="border-2 border-black bg-[#ff6b6b] text-white hover:bg-[#ff6b6b]/90"
            >
              Create Event
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EventConfirmationDialog;