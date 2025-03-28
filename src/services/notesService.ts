// src/services/notesService.ts
import { fetchWithAuth } from './authService';

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

// Function to normalize a directory path (convert directory parts to lowercase)
const normalizeDirectoryPath = (path: string): string => {
    // If it's the root directory, return as is
    if (path === '/') return path;

    // Split the path into segments
    const parts = path.split('/').filter(Boolean);
    
    // Check if this is an absolute path
    const isAbsolute = path.startsWith('/');
    
    // Convert all directory parts to lowercase
    const normalizedParts = parts.map(part => part.toLowerCase());
    
    // Reconstruct the normalized path
    let normalizedPath = normalizedParts.join('/');
    if (isAbsolute) normalizedPath = '/' + normalizedPath;
    if (path.endsWith('/')) normalizedPath += '/';
    
    return normalizedPath;
};

// Function to normalize a file path (normalizes directory parts but keeps filename as is)
const normalizeFilePath = (path: string): string => {
    // If it's the root directory, return as is
    if (path === '/') return path;

    // Split the path into segments
    const parts = path.split('/').filter(Boolean);
    
    // Check if this is an absolute path
    const isAbsolute = path.startsWith('/');
    
    // Normalize all parts except the last one (filename)
    const normalizedParts = parts.map((part, index) => {
        // If it's the last part, don't normalize it (keep the filename as is)
        if (index === parts.length - 1) {
            return part;
        }
        
        // For directory parts, normalize to lowercase
        return part.toLowerCase();
    });
    
    // Reconstruct the normalized path
    let normalizedPath = normalizedParts.join('/');
    if (isAbsolute) normalizedPath = '/' + normalizedPath;
    
    return normalizedPath;
};
  
export const notesService = {
    async listFiles(path: string): Promise<NoteFile[]> {
        try {
            // Normalize the directory path
            const normalizedPath = normalizeDirectoryPath(path);
            
            console.log(`Fetching files from path: ${path} (normalized: ${normalizedPath})`);
            const encodedPath = encodeURIComponent(normalizedPath);
            const url = `${API_URL}/notes/files?path=${encodedPath}`;
            
            console.log("API call URL:", url);
            const response = await fetchWithAuth(url);
            
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
            throw error;
        }
    },
    
    async createDirectory(path: string): Promise<void> {
        try {
            // Normalize the directory path
            const normalizedPath = normalizeDirectoryPath(path);
            
            console.log(`Creating directory at path: ${path} (normalized: ${normalizedPath})`);
            const response = await fetchWithAuth(`${API_URL}/notes/directory`, {
                method: 'POST',
                body: JSON.stringify({ path: normalizedPath }),
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
            
            console.log(`Directory created at ${normalizedPath}`);
        } catch (error) {
            console.error('Error creating directory:', error);
            throw error;
        }
    },
    
    async saveNote(path: string, content: string, metadata: { tags: string[], description: string }): Promise<void> {
        try {
            // Normalize the file path (directory parts but keep filename)
            const normalizedPath = normalizeFilePath(path);
            
            console.log(`Saving note at path: ${path} (normalized: ${normalizedPath})`);
            console.log("Content length:", content.length);
            console.log("Metadata:", metadata);
            
            const requestBody = {
                path: normalizedPath,
                content,
                tags: metadata.tags.join(','),
                description: metadata.description,
            };
            
            console.log("Request body:", JSON.stringify(requestBody));
            
            const response = await fetchWithAuth(`${API_URL}/notes/file`, {
                method: 'POST',
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
            
            console.log(`Note saved at ${normalizedPath}`);
        } catch (error) {
            console.error('Error saving note:', error);
            throw error;
        }
    },
    
    async getNoteContent(path: string): Promise<NoteContent> {
        try {
            // Normalize the file path (directory parts but keep filename)
            const normalizedPath = normalizeFilePath(path);
            
            console.log(`Fetching note content from: ${path} (normalized: ${normalizedPath})`);
            const encodedPath = encodeURIComponent(normalizedPath);
            const url = `${API_URL}/notes/file?path=${encodedPath}`;
            
            console.log("API call URL:", url);
            const response = await fetchWithAuth(url);
            
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
                    throw new Error(`Note not found at ${normalizedPath}`);
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
            // Normalize the source path (if it's a file, keep the filename as is)
            const normalizedSourcePath = normalizeFilePath(sourcePath);
            
            // For the destination path, we need to handle it based on whether it's a directory or file
            // If destinationPath ends with '/', treat it as a directory
            const isDestinationDirectory = destinationPath.endsWith('/');
            const normalizedDestinationPath = isDestinationDirectory
                ? normalizeDirectoryPath(destinationPath)
                : normalizeFilePath(destinationPath);
            
            console.log(`Moving file from ${sourcePath} (normalized: ${normalizedSourcePath}) to ${destinationPath} (normalized: ${normalizedDestinationPath})`);
            const response = await fetchWithAuth(`${API_URL}/notes/move`, {
                method: 'POST',
                body: JSON.stringify({
                    source: normalizedSourcePath,
                    destination: normalizedDestinationPath,
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
            
            console.log(`File moved successfully from ${normalizedSourcePath} to ${normalizedDestinationPath}`);
        } catch (error) {
            console.error('Error moving file:', error);
            throw error;
        }
    },
    
    async deleteFile(path: string): Promise<void> {
        try {
            // Normalize the path
            const normalizedPath = normalizeFilePath(path);
            
            console.log(`Deleting file at path: ${path} (normalized: ${normalizedPath})`);
            const encodedPath = encodeURIComponent(normalizedPath);
            const url = `${API_URL}/notes/file?path=${encodedPath}`;
            
            console.log("Delete API call URL:", url);
            const response = await fetchWithAuth(url, {
                method: 'DELETE',
            });
            
            const responseText = await response.text();
            console.log("Delete API response:", responseText);
            
            let data;
            try {
                data = JSON.parse(responseText);
            } catch (e) {
                console.error("Error parsing JSON response:", e);
                throw new Error(`Invalid response format: ${responseText}`);
            }
            
            if (!response.ok) {
                console.error(`Error deleting file (${response.status}):`, data);
                throw new Error(`Error deleting file: ${data.message || response.statusText}`);
            }
            
            console.log(`File successfully deleted at ${normalizedPath}`);
        } catch (error) {
            console.error('Error deleting file:', error);
            throw error;
        }
    },

    // Expose normalization functions for use elsewhere in the application
    normalizeDirectoryPath,
    normalizeFilePath
};