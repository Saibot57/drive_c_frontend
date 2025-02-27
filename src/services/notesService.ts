// src/services/notesService.ts

export interface NoteFile {
    id: string;
    name: string;
    file_path: string;
    is_folder: boolean;
    tags?: string[];
    url?: string;
    created_time?: string;
  }
  
  export interface NoteContent {
    id?: string;
    content: string;
    tags: string[];
    description: string;
  }
  
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://tobiaslundh1.pythonanywhere.com/api';
  
  export const notesService = {
    async listFiles(path: string): Promise<NoteFile[]> {
      try {
        console.log(`Fetching files from path: ${path}`);
        const encodedPath = encodeURIComponent(path);
        const url = `${API_URL}/notes/files?path=${encodedPath}`;
        
        console.log("API call URL:", url);
        const response = await fetch(url);
        
        const responseText = await response.text();
        console.log("API response:", responseText);
        
        // Parse the response text
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (e) {
          console.error("Error parsing JSON response:", e);
          throw new Error(`Invalid response format: ${responseText}`);
        }
        
        if (!response.ok) {
          console.error(`Error listing files (${response.status}):`, data);
          throw new Error(`Error listing files: ${data.message || response.statusText}`);
        }
        
        console.log(`Retrieved ${data.data?.length || 0} files:`, data.data);
        return data.data || [];
      } catch (error) {
        console.error('Error listing files:', error);
        return getMockFiles(path); // Fallback to mock data
      }
    },
    
    async createDirectory(path: string): Promise<void> {
      try {
        console.log(`Creating directory at path: ${path}`);
        const response = await fetch(`${API_URL}/notes/directory`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ path }),
        });
        
        const responseText = await response.text();
        console.log("API response:", responseText);
        
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (e) {
          console.error("Error parsing JSON response:", e);
          throw new Error(`Invalid response format: ${responseText}`);
        }
        
        if (!response.ok) {
          console.error(`Error creating directory (${response.status}):`, data);
          throw new Error(`Error creating directory: ${data.message || response.statusText}`);
        }
        
        console.log(`Directory created at ${path}`);
      } catch (error) {
        console.error('Error creating directory:', error);
        throw error;
      }
    },
    
    async saveNote(path: string, content: string, metadata: { tags: string[], description: string }): Promise<void> {
      try {
        console.log(`Saving note at path: ${path}`);
        console.log("Content length:", content.length);
        console.log("Metadata:", metadata);
        
        const requestBody = {
          path,
          content,
          tags: metadata.tags.join(','),
          description: metadata.description,
        };
        
        console.log("Request body:", JSON.stringify(requestBody));
        
        const response = await fetch(`${API_URL}/notes/file`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });
        
        const responseText = await response.text();
        console.log("API response:", responseText);
        
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (e) {
          console.error("Error parsing JSON response:", e);
          throw new Error(`Invalid response format: ${responseText}`);
        }
        
        if (!response.ok) {
          console.error(`Error saving note (${response.status}):`, data);
          throw new Error(`Error saving note: ${data.message || response.statusText}`);
        }
        
        console.log(`Note saved at ${path}`);
      } catch (error) {
        console.error('Error saving note:', error);
        throw error;
      }
    },
    
    async getNoteContent(path: string): Promise<NoteContent> {
      try {
        console.log(`Fetching note content from: ${path}`);
        const encodedPath = encodeURIComponent(path);
        const url = `${API_URL}/notes/file?path=${encodedPath}`;
        
        console.log("API call URL:", url);
        const response = await fetch(url);
        
        const responseText = await response.text();
        console.log("API response:", responseText);
        
        // Parse the response text
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (e) {
          console.error("Error parsing JSON response:", e);
          throw new Error(`Invalid response format: ${responseText}`);
        }
        
        if (!response.ok) {
          console.error(`Error fetching note (${response.status}):`, data);
          
          // If the note doesn't exist (404), throw a specific error
          if (response.status === 404) {
            throw new Error(`Note not found at ${path}`);
          }
          
          throw new Error(`Error fetching note: ${data.message || response.statusText}`);
        }
        
        if (!data.data || typeof data.data.content !== 'string') {
          console.error('Invalid response format:', data);
          throw new Error('Invalid response format from server');
        }
        
        console.log(`Retrieved note content:`, data.data);
        
        // Make sure we always return a properly formatted NoteContent
        return {
          content: data.data.content || '',
          tags: Array.isArray(data.data.tags) ? data.data.tags : [],
          description: data.data.description || '',
          ...(data.data.id ? { id: data.data.id } : {})
        };
      } catch (error) {
        console.error('Error fetching note content:', error);
        throw error;
      }
    },
    
    async moveFile(sourcePath: string, destinationPath: string): Promise<void> {
      try {
        console.log(`Moving file from ${sourcePath} to ${destinationPath}`);
        const response = await fetch(`${API_URL}/notes/move`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            source: sourcePath,
            destination: destinationPath,
          }),
        });
        
        const responseText = await response.text();
        console.log("Move API response:", responseText);
        
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (e) {
          console.error("Error parsing JSON response:", e);
          throw new Error(`Invalid response format: ${responseText}`);
        }
        
        if (!response.ok) {
          console.error(`Error moving file (${response.status}):`, data);
          throw new Error(`Error moving file: ${data.message || response.statusText}`);
        }
        
        console.log(`File moved successfully from ${sourcePath} to ${destinationPath}`);
      } catch (error) {
        console.error('Error moving file:', error);
        throw error;
      }
    }
  };
  
  // Mock data for development purposes
  function getMockFiles(path: string): NoteFile[] {
    console.log(`Returning mock files for path: ${path}`);
    
    if (path === '/') {
      return [
        { id: '1', name: 'Documents', file_path: '/Documents', is_folder: true, created_time: new Date().toISOString() },
        { id: '2', name: 'Projects', file_path: '/Projects', is_folder: true, created_time: new Date().toISOString() },
        { id: '3', name: 'todo.txt', file_path: '/todo.txt', is_folder: false, tags: ['todo', 'important'], created_time: new Date().toISOString() },
      ];
    } else if (path === '/Documents') {
      return [
        { id: '4', name: 'notes.txt', file_path: '/Documents/notes.txt', is_folder: false, tags: ['notes'], created_time: new Date().toISOString() },
        { id: '5', name: 'Personal', file_path: '/Documents/Personal', is_folder: true, created_time: new Date().toISOString() },
      ];
    } else if (path === '/Projects') {
      return [
        { id: '6', name: 'project-ideas.txt', file_path: '/Projects/project-ideas.txt', is_folder: false, tags: ['projects', 'ideas'], created_time: new Date().toISOString() },
      ];
    } else {
      return [];
    }
  }