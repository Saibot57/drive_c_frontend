// test-calendar-api.js
async function testCalendarAPI() {
    const API_URL = 'https://tobiaslundh1.pythonanywhere.com/api';
    
    try {
      console.log('Testing Calendar API...');
      
      // 1. Create an event
      console.log('1. Creating a test event...');
      const createResponse = await fetch(`${API_URL}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: "API Test Event",
          start: "2025-02-21T10:00:00Z",
          end: "2025-02-21T11:00:00Z",
          notes: "Testing the calendar API"
        })
      });
      
      if (!createResponse.ok) {
        throw new Error(`Failed to create event: ${createResponse.status}`);
      }
      
      const eventData = await createResponse.json();
      console.log('Event created successfully:', eventData);
      const eventId = eventData.data.id;
      
      // 2. Get events
      console.log('2. Fetching events...');
      const getResponse = await fetch(`${API_URL}/events`);
      
      if (!getResponse.ok) {
        throw new Error(`Failed to fetch events: ${getResponse.status}`);
      }
      
      const events = await getResponse.json();
      console.log(`Retrieved ${events.data.length} events`);
      
      // 3. Update event
      console.log('3. Updating event...');
      const updateResponse = await fetch(`${API_URL}/events/${eventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: "Updated API Test Event",
          notes: "This event has been updated through API testing"
        })
      });
      
      if (!updateResponse.ok) {
        throw new Error(`Failed to update event: ${updateResponse.status}`);
      }
      
      console.log('Event updated successfully');
      
      // 4. Save a day note
      console.log('4. Saving a day note...');
      const noteDateStr = '2025-02-21';
      const saveNoteResponse = await fetch(`${API_URL}/notes/${noteDateStr}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: "Test note for API testing"
        })
      });
      
      if (!saveNoteResponse.ok) {
        throw new Error(`Failed to save note: ${saveNoteResponse.status}`);
      }
      
      console.log('Day note saved successfully');
      
      // 5. Get the day note
      console.log('5. Getting day note...');
      const getNoteResponse = await fetch(`${API_URL}/notes/${noteDateStr}`);
      
      if (!getNoteResponse.ok) {
        throw new Error(`Failed to get note: ${getNoteResponse.status}`);
      }
      
      const noteData = await getNoteResponse.json();
      console.log('Day note retrieved successfully:', noteData);
      
      // 6. Delete event
      console.log('6. Deleting event...');
      const deleteResponse = await fetch(`${API_URL}/events/${eventId}`, {
        method: 'DELETE'
      });
      
      if (!deleteResponse.ok) {
        throw new Error(`Failed to delete event: ${deleteResponse.status}`);
      }
      
      console.log('Event deleted successfully');
      
      console.log('All tests passed!');
    } catch (error) {
      console.error('Test failed:', error);
    }
  }
  
  testCalendarAPI();