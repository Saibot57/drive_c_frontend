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
        
        const response = await fetch(url);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Error listing files (${response.status}): ${errorText}`);
          throw new Error(`Error listing files: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log(`Retrieved ${data.data?.length || 0} files:`, data.data);
        return data.data || [];
      } catch (error) {
        console.error('Error listing files:', error);
        // Return mock data for development until backend is ready
        return getMockFiles(path);
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
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Error creating directory (${response.status}): ${errorText}`);
          throw new Error(`Error creating directory: ${response.statusText}`);
        }
        
        console.log(`Directory created at ${path}`);
      } catch (error) {
        console.error('Error creating directory:', error);
        // For development until backend is ready
        console.log(`Mock: Created directory at ${path}`);
      }
    },
    
    async saveNote(path: string, content: string, metadata: { tags: string[], description: string }): Promise<void> {
      try {
        console.log(`Saving note at path: ${path}`);
        const response = await fetch(`${API_URL}/notes/file`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            path,
            content,
            tags: metadata.tags.join(','),
            description: metadata.description,
          }),
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Error saving note (${response.status}): ${errorText}`);
          throw new Error(`Error saving note: ${response.statusText}`);
        }
        
        console.log(`Note saved at ${path}`);
      } catch (error) {
        console.error('Error saving note:', error);
        // For development until backend is ready
        console.log(`Mock: Saved note at ${path}`);
      }
    },
    
    async getNoteContent(path: string): Promise<NoteContent> {
      try {
        console.log(`Fetching note content from: ${path}`);
        const encodedPath = encodeURIComponent(path);
        const url = `${API_URL}/notes/file?path=${encodedPath}`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Error fetching note (${response.status}): ${errorText}`);
          throw new Error(`Error fetching note: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log(`Retrieved note content:`, data.data);
        return data.data;
      } catch (error) {
        console.error('Error fetching note content:', error);
        // Return mock data for development until backend is ready
        return {
          content: `This is a mock note for ${path}`,
          tags: ['mock', 'development'],
          description: 'This is a mock note for development purposes',
        };
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