import React, { useState } from 'react';
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
  const [title, setTitle] = React.useState('');
  const [notes, setNotes] = React.useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm({
      title: title || 'New Event',
      notes,
      start: startTime,
      end: endTime,
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

  return (
    <div className="fixed inset-0 z-50 bg-black/20 flex items-center justify-center">
      <div 
        className="w-full max-w-lg bg-white rounded-xl border-2 border-black shadow-neo"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b-2 border-black">
          <h2 className="font-monument text-2xl">New Event</h2>
          <Button
            onClick={onClose}
            variant="neutral"
            className="h-8 w-8 p-0"
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
              className="w-full"
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block font-monument text-sm mb-2">Start Time</label>
              <div className="h-10 px-3 flex items-center rounded-xl border-2 border-black bg-gray-50">
                {formatTime(startTime)}
              </div>
            </div>
            <div className="flex-1">
              <label className="block font-monument text-sm mb-2">End Time</label>
              <div className="h-10 px-3 flex items-center rounded-xl border-2 border-black bg-gray-50">
                {formatTime(endTime)}
              </div>
            </div>
          </div>

          <div>
            <label className="block font-monument text-sm mb-2">Notes</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add event notes..."
              className="w-full"
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