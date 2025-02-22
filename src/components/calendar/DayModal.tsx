// src/components/calendar/DayModal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { X, Plus, Save, MoreVertical, Edit, Trash } from "lucide-react";
import { DayModalProps, Event } from './types';
import { TimeGrid } from './TimeGrid';
import { EventCard } from './EventCard';
import { ScrollArea } from "@/components/ui/scroll-area";
import { calendarService } from '@/services/calendarService';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";

export const DayModal: React.FC<DayModalProps> = ({
  date,
  events,
  isOpen,
  onClose,
  onEventAdd,
  onEventUpdate,
  onEventDelete,
  onSaveNotes
}) => {
  const [notes, setNotes] = useState<string>('');
  const [quickEventMode, setQuickEventMode] = useState(false);
  const [isNotesLoading, setIsNotesLoading] = useState(false);
  const [isNotesSaving, setIsNotesSaving] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [contextMenuEvent, setContextMenuEvent] = useState<{ id: string, x: number, y: number } | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [eventBeingEdited, setEventBeingEdited] = useState<string | null>(null);

  // Fetch day notes when modal opens
  useEffect(() => {
    if (isOpen && date) {
      fetchDayNotes();
    }
  }, [isOpen, date]);

  // Handle closing context menu on click outside
  useEffect(() => {
    if (contextMenuEvent) {
      const handleClickOutside = () => setContextMenuEvent(null);
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenuEvent]);

  const fetchDayNotes = async () => {
    try {
      setIsNotesLoading(true);
      setNotesError(null);
      
      console.log('Fetching day notes for:', date);
      const dayNote = await calendarService.getDayNote(date);
      console.log('Retrieved day notes:', dayNote);
      setNotes(dayNote.notes || '');
    } catch (error) {
      console.error("Error fetching day notes:", error);
      setNotesError("Failed to load notes");
    } finally {
      setIsNotesLoading(false);
    }
  };

  const handleSaveNotes = async () => {
    try {
      setIsNotesSaving(true);
      setNotesError(null);
      
      console.log('Saving day notes:', notes);
      await calendarService.saveDayNote(date, notes);
      console.log('Notes saved successfully');
      
      // Call parent handler if provided
      if (onSaveNotes) {
        onSaveNotes(notes);
      }
    } catch (error) {
      console.error("Error saving notes:", error);
      setNotesError("Failed to save notes");
    } finally {
      setIsNotesSaving(false);
    }
  };

  const handleQuickEventAdd = () => {
    const now = new Date(date);
    const currentHour = now.getHours();
    
    const startTime = new Date(date);
    startTime.setHours(currentHour + 1, 0, 0, 0);
    
    const endTime = new Date(date);
    endTime.setHours(currentHour + 2, 0, 0, 0);

    console.log('Adding quick event');
    onEventAdd({
      title: 'New Event',
      start: startTime,
      end: endTime,
      notes: '',
      isEditing: true // Start in editing mode
    });
    setQuickEventMode(false);
  };

  const handleContextMenu = (e: React.MouseEvent, eventId: string) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Context menu opened for event:', eventId);
    setContextMenuEvent({ id: eventId, x: e.clientX, y: e.clientY });
  };

  const handleEventUpdate = (eventId: string, updates: Partial<Event>) => {
    console.log('Handling event update in DayModal:', eventId, updates);
    
    // Check if this was previously being edited
    if (eventBeingEdited === eventId && !updates.isEditing) {
      setEventBeingEdited(null);
    }
    
    // If we're entering edit mode, track this event
    if (updates.isEditing) {
      setEventBeingEdited(eventId);
    }

    // Pass the update to the parent
    if (onEventUpdate) {
      onEventUpdate(eventId, updates);
    }
  };

  const handleEditEvent = (eventId: string) => {
    console.log('Editing event:', eventId);
    // Find the event in the events array
    const eventToEdit = events.find(e => e.id === eventId);
    if (!eventToEdit) return;
    
    setEventBeingEdited(eventId);
    if (onEventUpdate) {
      // This ensures the isEditing flag is correctly set
      onEventUpdate(eventId, { 
        ...eventToEdit,
        isEditing: true 
      });
    }
    setSelectedEvent(null);
    if (contextMenuEvent) {
      setContextMenuEvent(null);
    }
  };

  if (!isOpen) return null;

  const sortedEvents = [...events].sort((a, b) => 
    a.start.getTime() - b.start.getTime()
  );

  const selectedEventData = selectedEvent ? events.find(e => e.id === selectedEvent) : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/20 flex items-center justify-center">
      <div 
        className="relative w-[90vw] h-[80vh] max-w-6xl bg-white rounded-xl border-2 border-black shadow-neo"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with close button */}
        <div className="flex items-center justify-between p-6 border-b-2 border-black bg-[#ff6b6b]">
          <h2 className="font-monument text-2xl text-white">
            {date.toLocaleDateString('en-US', { 
              weekday: 'long',
              month: 'long',
              day: 'numeric'
            })}
          </h2>
          <Button
            onClick={onClose}
            variant="neutral"
            className="h-8 w-8 p-0 bg-white hover:bg-gray-50"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="h-[calc(100%-5rem)]">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            {/* Time Grid Section */}
            <ResizablePanel defaultSize={35} minSize={25}>
              <div className="h-full border-r-2 border-black">
                <TimeGrid 
                  events={events}
                  onEventAdd={onEventAdd}
                  onEventUpdate={handleEventUpdate}
                  date={date}
                />
              </div>
            </ResizablePanel>
            
            <ResizableHandle withHandle />
            
            {/* Events & Notes Section */}
            <ResizablePanel defaultSize={65}>
              <ResizablePanelGroup direction="vertical">
                {/* Events List */}
                <ResizablePanel 
                  defaultSize={40} 
                  minSize={20}
                >
                  <div className="h-full border-b-2 border-black p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-monument text-lg">Events</h3>
                      <Button
                        onClick={handleQuickEventAdd}
                        variant="neutral"
                        className="h-8 px-2 border-2 border-black bg-white hover:bg-gray-50"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Event
                      </Button>
                    </div>
                    
                    <ScrollArea className="h-[calc(100%-3rem)]">
                      <div className="space-y-2">
                        {sortedEvents.map(event => (
                          <div 
                            key={event.id}
                            onContextMenu={(e) => handleContextMenu(e, event.id)}
                            onClick={() => setSelectedEvent(event.id)}
                            className="relative"
                          >
                            <EventCard 
                              event={event}
                              isPreview
                              onUpdate={handleEventUpdate}
                              onEdit={() => setSelectedEvent(event.id)}
                            />
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </ResizablePanel>
                
                <ResizableHandle withHandle />
                
                {/* Notes Section */}
                <ResizablePanel defaultSize={60}>
                  <div className="p-6 h-full flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-monument text-lg">Notes</h3>
                      <Button
                        onClick={handleSaveNotes}
                        disabled={isNotesSaving}
                        variant="neutral"
                        className="h-8 px-2 border-2 border-black bg-white hover:bg-gray-50"
                      >
                        <Save className="h-4 w-4 mr-1" />
                        Save
                      </Button>
                    </div>
                    
                    {isNotesLoading ? (
                      <div className="flex items-center justify-center h-full">
                        <p>Loading notes...</p>
                      </div>
                    ) : (
                      <>
                        {notesError && (
                          <div className="text-red-500 text-sm mb-2">{notesError}</div>
                        )}
                        <Textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Add notes for this day..."
                          className="w-full flex-1 rounded-lg border-2 border-black p-2 resize-none"
                        />
                      </>
                    )}
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>

        {/* Context Menu */}
        {contextMenuEvent && (
          <div 
            className="fixed z-[90] bg-white border-2 border-black rounded-lg shadow-neo overflow-hidden"
            style={{
              left: `${contextMenuEvent.x}px`,
              top: `${contextMenuEvent.y}px`
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col">
              <button 
                className="px-4 py-2 text-left hover:bg-gray-100 flex items-center"
                onClick={() => handleEditEvent(contextMenuEvent.id)}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </button>
              <button 
                className="px-4 py-2 text-left hover:bg-gray-100 text-red-500 flex items-center"
                onClick={() => {
                  if (onEventDelete) {
                    onEventDelete(contextMenuEvent.id);
                    setContextMenuEvent(null);
                  }
                }}
              >
                <Trash className="h-4 w-4 mr-2" />
                Delete
              </button>
            </div>
          </div>
        )}

        {/* Event Detail View */}
        {selectedEventData && !eventBeingEdited && (
          <div className="fixed inset-0 z-[100] bg-black/20 flex items-center justify-center">
            <div 
              className="w-[90vw] max-w-xl bg-white rounded-xl border-2 border-black shadow-neo"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b-2 border-black text-center"
                   style={{ backgroundColor: selectedEventData.color || '#ff6b6b' }}>
                <h2 className="font-monument text-xl text-white">{selectedEventData.title}</h2>
                <div className="text-white mt-1">
                  {selectedEventData.start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - 
                  {selectedEventData.end.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </div>
              </div>
              
              <div className="p-6">
                <Textarea
                  value={selectedEventData.notes || ''}
                  onChange={(e) => {
                    if (onEventUpdate) {
                      onEventUpdate(selectedEventData.id, { notes: e.target.value });
                    }
                  }}
                  placeholder="Add event notes..."
                  className="w-full min-h-[200px] rounded-lg border-2 border-black p-2"
                />
              </div>
              
              <div className="flex justify-end p-4 border-t-2 border-black">
                <Button
                  onClick={() => setSelectedEvent(null)}
                  variant="neutral"
                  className="h-10 px-4 border-2 border-black bg-white hover:bg-gray-50"
                >
                  Close
                </Button>
                <Button
                  onClick={() => handleEditEvent(selectedEventData.id)}
                  variant="neutral"
                  className="h-10 px-4 ml-2 border-2 border-black bg-[#ff6b6b] text-white hover:bg-[#ff6b6b]/90"
                >
                  Edit Details
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};