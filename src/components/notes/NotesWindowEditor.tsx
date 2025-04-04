// src/components/notes/NotesWindowEditor.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Save, X, FileText, Edit2 } from 'lucide-react';
import { notesService } from '@/services/notesService';

interface NotesWindowEditorProps {
  initialFilename: string;
  initialPath?: string;
  onClose?: () => void;
}

const NotesWindowEditor: React.FC<NotesWindowEditorProps> = ({
  initialFilename,
  initialPath,
  onClose,
}) => {
  // State for the editor
  const [content, setContent] = useState('');
  const [filename, setFilename] = useState(initialFilename);
  const [isEditingFilename, setIsEditingFilename] = useState(false);
  const [tagsInput, setTagsInput] = useState('');
  const [description, setDescription] = useState('');
  const [currentPath, setCurrentPath] = useState(initialPath || '/');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Template creation state
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');

  // Load note content if it exists
  useEffect(() => {
    const loadNote = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Determine the full path
        const path = currentPath === '/' 
          ? `/${filename}` 
          : `${currentPath}/${filename}`;
        
        // Try to get the note content
        const noteContent = await notesService.getNoteContent(path);
        
        // Set state with the loaded content
        setContent(noteContent.content || '');
        setTagsInput(noteContent.tags.join(', '));
        setDescription(noteContent.description || '');
        
      } catch (error) {
        // If the note doesn't exist, that's fine - we're creating a new one
        if (error instanceof Error && error.message.includes('not found')) {
          console.log("Note not found, creating new file");
          setContent('');
          setTagsInput('');
          setDescription('');
        } else {
          // For other errors, show an error message
          console.error("Error loading note:", error);
          setError(error instanceof Error ? error.message : String(error));
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    loadNote();
  }, [filename, currentPath]);

  // Handle saving the note
  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    setError(null);
    
    try {
      // Get full path
      const path = currentPath === '/' 
        ? `/${filename}` 
        : `${currentPath}/${filename}`;
      
      // Process tags
      const tags = tagsInput
        .split(',')
        .map(tag => tag.trim())
        .filter(Boolean);
      
      // Save the note
      await notesService.saveNote(path, content, {
        tags,
        description,
      });
      
      // Show success message
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
      }, 2000);
      
    } catch (error) {
      console.error('Error saving note:', error);
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAsTemplate = async () => {
    try {
      // Import template service
      const { saveTemplate } = await import('../../services/templateService');
      
      // Create template object
      const template = {
        name: templateName,
        content: content,
        tags: tagsInput.split(',').map(tag => tag.trim()).filter(Boolean),
        description: templateDescription || description
      };
      
      // Save the template
      const success = saveTemplate(templateName, template);
      
      if (success) {
        // Show success message
        alert(`Template saved: ${templateName}`);
        setShowTemplateForm(false);
      } else {
        alert(`Failed to save template: ${templateName}`);
      }
    } catch (error) {
      console.error('Error saving template:', error);
      alert(`Error saving template: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const toggleFilenameEdit = () => {
    setIsEditingFilename(!isEditingFilename);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-main mx-auto"></div>
          <p className="mt-2">Loading note...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b-2 border-black p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1 flex items-center">
            {isEditingFilename ? (
              <Input
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                className="w-full border-2 border-black mr-2"
                autoFocus
                onBlur={toggleFilenameEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    toggleFilenameEdit();
                  }
                }}
              />
            ) : (
              <h3 className="flex-1 text-lg font-medium truncate mr-2">{filename}</h3>
            )}
            <Button 
              onClick={toggleFilenameEdit} 
              variant="neutral" 
              size="sm"
              className="flex items-center h-8 px-2 border-2 border-black bg-white hover:bg-gray-50"
            >
              <Edit2 className="h-4 w-4 mr-1" />
              <span>{isEditingFilename ? 'Done' : 'Rename'}</span>
            </Button>
          </div>
          <div className="flex items-center ml-2">
            {saveSuccess && (
              <span className="text-green-500 text-sm mr-2">Saved!</span>
            )}
            {error && (
              <span className="text-red-500 text-sm mr-2">Error: {error}</span>
            )}
          </div>
        </div>
        <div className="text-sm text-gray-500 mt-1">
          Path: {currentPath === '/' ? '/' : currentPath + '/'}
        </div>
      </div>
      
      <div className="flex-1 p-4">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full h-full min-h-[300px] resize-none font-mono border-2 border-black focus-visible:ring-0"
          placeholder="Write your note here..."
          autoFocus
        />
      </div>
      
      <div className="border-t-2 border-black p-4 space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium">Tags (comma separated)</label>
          <Input
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            className="w-full border-2 border-black"
            placeholder="productivity, ideas, todo"
          />
        </div>
        
        <div className="space-y-2">
          <label className="block text-sm font-medium">Description</label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border-2 border-black"
            placeholder="Brief description of this note"
          />
        </div>
        
        <div className="flex justify-end space-x-2">
          {onClose && (
            <Button 
              onClick={onClose}
              variant="neutral"
              className="flex items-center border-2 border-black bg-white hover:bg-gray-50"
            >
              <X className="mr-2 h-4 w-4" />
              Close
            </Button>
          )}
          <Button
            onClick={() => setShowTemplateForm(true)}
            variant="neutral"
            className="flex items-center border-2 border-black bg-white hover:bg-gray-50"
          >
            <FileText className="mr-2 h-4 w-4" />
            Save as Template
          </Button>
          <Button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center border-2 border-black bg-main text-white hover:bg-main/90"
          >
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Template creation form */}
      {showTemplateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full border-2 border-black">
            <h3 className="text-lg font-bold mb-4">Save as Template</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium">Template Name</label>
                <Input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="my-template-name"
                  className="border-2 border-black"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium">Template Description</label>
                <Input
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  placeholder={description || "Brief description of this template"}
                  className="border-2 border-black"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <Button variant="neutral" className="border-2 border-black bg-white" onClick={() => setShowTemplateForm(false)}>
                Cancel
              </Button>
              <Button className="border-2 border-black bg-main text-white" onClick={handleSaveAsTemplate}>
                Save Template
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotesWindowEditor;