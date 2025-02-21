// Create this file at: src/services/calendarService.ts

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
        
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`Error fetching events: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.data;
      } catch (error) {
        console.error('Error fetching events:', error);
        throw error;
      }
    },
    
    async createEvent(event: Omit<CalendarEvent, 'id'>): Promise<CalendarEvent> {
      try {
        const response = await fetch(`${API_URL}/events`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        });
        
        if (!response.ok) {
          throw new Error(`Error creating event: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.data;
      } catch (error) {
        console.error('Error creating event:', error);
        throw error;
      }
    },
    
    async updateEvent(id: string, updates: Partial<CalendarEvent>): Promise<CalendarEvent> {
      try {
        const response = await fetch(`${API_URL}/events/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updates),
        });
        
        if (!response.ok) {
          throw new Error(`Error updating event: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.data;
      } catch (error) {
        console.error('Error updating event:', error);
        throw error;
      }
    },
    
    async deleteEvent(id: string): Promise<void> {
      try {
        const response = await fetch(`${API_URL}/events/${id}`, {
          method: 'DELETE',
        });
        
        if (!response.ok) {
          throw new Error(`Error deleting event: ${response.statusText}`);
        }
      } catch (error) {
        console.error('Error deleting event:', error);
        throw error;
      }
    },
    
    async getDayNote(date: Date): Promise<DayNote> {
      try {
        const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
        const response = await fetch(`${API_URL}/notes/${dateStr}`);
        
        if (!response.ok) {
          throw new Error(`Error fetching day note: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.data;
      } catch (error) {
        console.error('Error fetching day note:', error);
        throw error;
      }
    },
    
    async saveDayNote(date: Date, notes: string): Promise<DayNote> {
      try {
        const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
        const response = await fetch(`${API_URL}/notes/${dateStr}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ notes }),
        });
        
        if (!response.ok) {
          throw new Error(`Error saving day note: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.data;
      } catch (error) {
        console.error('Error saving day note:', error);
        throw error;
      }
    }
  };