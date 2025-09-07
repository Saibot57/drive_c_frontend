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

export const notesService = {
    async listFiles(path: string): Promise<NoteFile[]> {
        const encodedPath = encodeURIComponent(path);
        const response = await fetchWithAuth(`${API_URL}/notes/files?path=${encodedPath}`);
        if (!response.success) throw new Error(response.error || 'Error listing files');
        return response.data.data || [];
    },

    async createDirectory(path: string): Promise<void> {
        const response = await fetchWithAuth(`${API_URL}/notes/directory`, {
            method: 'POST',
            body: JSON.stringify({ path }),
        });
        if (!response.success) throw new Error(response.error || 'Error creating directory');
    },

    async saveNote(path: string, content: string, metadata: { tags: string[], description: string }): Promise<void> {
        const requestBody = {
            path,
            content,
            tags: metadata.tags.join(','),
            description: metadata.description,
        };

        const response = await fetchWithAuth(`${API_URL}/notes/file`, {
            method: 'POST',
            body: JSON.stringify(requestBody),
        });
        if (!response.success) throw new Error(response.error || 'Error saving note');
    },

    async getNoteContent(path: string): Promise<NoteContent> {
        const encodedPath = encodeURIComponent(path);
        const response = await fetchWithAuth(`${API_URL}/notes/file?path=${encodedPath}`);
        if (!response.success) {
            if (response.error?.includes('not found')) {
                throw new Error(`Note not found at ${path}`);
            }
            throw new Error(response.error || 'Error fetching note');
        }

        const data = response.data.data || {};
        return {
            content: data.content || '',
            tags: Array.isArray(data.tags) ? data.tags : [],
            description: data.description || '',
            ...(data.id ? { id: data.id } : {})
        };
    },

    async moveFile(sourcePath: string, destinationPath: string): Promise<void> {
        const response = await fetchWithAuth(`${API_URL}/notes/move`, {
            method: 'POST',
            body: JSON.stringify({ source: sourcePath, destination: destinationPath }),
        });
        if (!response.success) throw new Error(response.error || 'Error moving file');
    },

    async deleteFile(path: string): Promise<void> {
        const encodedPath = encodeURIComponent(path);
        const response = await fetchWithAuth(`${API_URL}/notes/file?path=${encodedPath}`, {
            method: 'DELETE',
        });
        if (!response.success) throw new Error(response.error || 'Error deleting file');
    }
};

