// src/services/calendarService.ts

export interface CalendarEvent {
    id: string;
    title: string;
    start: string; // ISO date string
    end: string;   // ISO date string
    notes?: string;
    color?: string;
  }
  
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
          params.append('start', startDate.toISOString());
        }
        
        if (endDate) {
          params.append('end', endDate.toISOString());
        }
        
        if (params.toString()) {
          url += `?${params.toString()}`;
        }
        
        console.log(`Fetching events from: ${url}`);
        const response = await fetch(url);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Event fetch error (${response.status}): ${errorText}`);
          throw new Error(`Error fetching events: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log(`Retrieved ${data.data?.length || 0} events`);
        return data.data || [];
      } catch (error) {
        console.error('Error fetching events:', error);
        throw error;
      }
    },
    
    async createEvent(event: Omit<CalendarEvent, 'id'>): Promise<CalendarEvent> {
      try {
        console.log(`Creating event: ${JSON.stringify(event)}`);
        const response = await fetch(`${API_URL}/events`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Event creation error (${response.status}): ${errorText}`);
          throw new Error(`Error creating event: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log(`Event created with ID: ${data.data?.id}`);
        return data.data;
      } catch (error) {
        console.error('Error creating event:', error);
        throw error;
      }
    },
    
    async updateEvent(id: string, updates: Partial<CalendarEvent>): Promise<CalendarEvent> {
      try {
        console.log(`Updating event ${id}: ${JSON.stringify(updates)}`);
        const response = await fetch(`${API_URL}/events/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updates),
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Event update error (${response.status}): ${errorText}`);
          throw new Error(`Error updating event: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log(`Event updated successfully`);
        return data.data;
      } catch (error) {
        console.error('Error updating event:', error);
        throw error;
      }
    },
    
    async deleteEvent(id: string): Promise<void> {
      try {
        console.log(`Deleting event: ${id}`);
        const response = await fetch(`${API_URL}/events/${id}`, {
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
        const response = await fetch(`${API_URL}/notes/${dateStr}`);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Note fetch error (${response.status}): ${errorText}`);
          throw new Error(`Error fetching day note: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log(`Retrieved note for ${dateStr}`);
        return data.data;
      } catch (error) {
        console.error('Error fetching day note:', error);
        throw error;
      }
    },
    
    async saveDayNote(date: Date, notes: string): Promise<DayNote> {
      try {
        const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
        console.log(`Saving note for date: ${dateStr}`);
        const response = await fetch(`${API_URL}/notes/${dateStr}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ notes }),
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Note save error (${response.status}): ${errorText}`);
          throw new Error(`Error saving day note: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log(`Note saved successfully for ${dateStr}`);
        return data.data;
      } catch (error) {
        console.error('Error saving day note:', error);
        throw error;
      }
    }
  };