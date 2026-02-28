// src/services/calendarService.ts
import { fetchWithAuth } from './authService';

// Interface for API communication - only using number timestamps
export interface CalendarEvent {
    id: string;
    title: string;
    start: number; // Millisecond timestamp
    end: number;   // Millisecond timestamp
    notes?: string;
    color?: string;
}

// For creating events - supports Date objects, timestamps, and strings
export type EventInput = {
    title: string;
    notes?: string;
    color?: string;
} & (
    // Either Date objects
    { start: Date; end: Date; } |
    // Or timestamp numbers
    { start: number; end: number; } |
    // Or string dates (for backward compatibility)
    { start: string; end: string; }
);

export interface DayNote {
    id?: string;
    date: string; // ISO date string (YYYY-MM-DD)
    notes: string;
}
  
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://tobiaslundh1.pythonanywhere.com/api';
  
export const calendarService = {
    async getEvents(startDate?: Date, endDate?: Date): Promise<CalendarEvent[]> {
        try {
            let url = `${API_URL}/events`;
            const params = new URLSearchParams();
            
            if (startDate) {
                params.append('start', startDate.getTime().toString());
            }
            
            if (endDate) {
                params.append('end', endDate.getTime().toString());
            }
            
            if (params.toString()) {
                url += `?${params.toString()}`;
            }
            
            console.log(`Fetching events from: ${url}`);
            const response = await fetchWithAuth(url);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Event fetch error (${response.status}): ${errorText}`);
                throw new Error(`Error fetching events: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log(`Retrieved ${data.data?.length || 0} events:`, data.data);
            return data.data || [];
        } catch (error) {
            console.error('Error fetching events:', error);
            throw error;
        }
    },
    
    async createEvent(event: EventInput): Promise<CalendarEvent> {
        try {
            // Convert to millisecond timestamps based on input type
            const eventData = {
                title: event.title,
                start: convertToTimestamp(event.start),
                end: convertToTimestamp(event.end),
                notes: event.notes,
                color: event.color
            };
            
            console.log(`Creating event with timestamps:`, eventData);
            const response = await fetchWithAuth(`${API_URL}/events`, {
                method: 'POST',
                body: JSON.stringify(eventData),
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Event creation error (${response.status}): ${errorText}`);
                throw new Error(`Error creating event: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log(`Event created with ID: ${data.data?.id}`, data.data);
            return data.data;
        } catch (error) {
            console.error('Error creating event:', error);
            throw error;
        }
    },
    
    async updateEvent(id: string, updates: Partial<{
        title?: string;
        start?: Date | number | string;
        end?: Date | number | string;
        notes?: string;
        color?: string;
    }>): Promise<CalendarEvent> {
        try {
            // Convert Date or string to millisecond timestamps
            const eventUpdates: any = { ...updates };
            
            if (updates.start !== undefined) {
                eventUpdates.start = convertToTimestamp(updates.start);
            }
            
            if (updates.end !== undefined) {
                eventUpdates.end = convertToTimestamp(updates.end);
            }
            
            console.log(`Updating event ${id}:`, eventUpdates);
            const response = await fetchWithAuth(`${API_URL}/events/${id}`, {
                method: 'PUT',
                body: JSON.stringify(eventUpdates),
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Event update error (${response.status}): ${errorText}`);
                throw new Error(`Error updating event: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log(`Event updated successfully:`, data.data);
            return data.data;
        } catch (error) {
            console.error('Error updating event:', error);
            throw error;
        }
    },
    
    async deleteEvent(id: string): Promise<void> {
        try {
            console.log(`Deleting event: ${id}`);
            const response = await fetchWithAuth(`${API_URL}/events/${id}`, {
                method: 'DELETE',
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Event deletion error (${response.status}): ${errorText}`);
                throw new Error(`Error deleting event: ${response.statusText}`);
            }
            
            console.log(`Event deleted successfully`);
        } catch (error) {
            console.error('Error deleting event:', error);
            throw error;
        }
    },
    
    async getDayNote(date: Date): Promise<DayNote> {
        try {
            const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
            console.log(`Getting note for date: ${dateStr}`);
            const response = await fetchWithAuth(`${API_URL}/notes/${dateStr}`);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Note fetch error (${response.status}): ${errorText}`);
                throw new Error(`Error fetching day note: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log(`Retrieved note for ${dateStr}:`, data.data);
            return data.data;
        } catch (error) {
            console.error('Error fetching day note:', error);
            throw error;
        }
    },
    
    async saveDayNote(date: Date, notes: string): Promise<DayNote> {
        try {
            const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
            console.log(`Saving note for date: ${dateStr}`, notes);
            const response = await fetchWithAuth(`${API_URL}/notes/${dateStr}`, {
                method: 'POST',
                body: JSON.stringify({ notes }),
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Note save error (${response.status}): ${errorText}`);
                throw new Error(`Error saving day note: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log(`Note saved successfully for ${dateStr}:`, data.data);
            return data.data;
        } catch (error) {
            console.error('Error saving day note:', error);
            throw error;
        }
    }
};

// Helper function to convert various date formats to millisecond timestamps
function convertToTimestamp(value: Date | number | string): number {
    if (value instanceof Date) {
        return value.getTime();
    } else if (typeof value === 'string') {
        // Try to parse ISO string to Date first, then get timestamp
        return new Date(value).getTime();
    } else {
        // Already a number timestamp
        return value;
    }
}