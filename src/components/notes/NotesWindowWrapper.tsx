// src/components/notes/NotesWindowWrapper.tsx
'use client';

import React, { useState, useEffect } from 'react';
import NotesWindowEditor from './NotesWindowEditor';
import { useWindowManager } from '@/contexts/WindowContext';
import { Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface NotesWindowWrapperProps {
  filename?: string;
  path?: string;
}

const NotesWindowWrapper: React.FC<NotesWindowWrapperProps> = ({ 
  filename = 'untitled.md',
  path = '/'
}) => {
  const { closeWindow } = useWindowManager();
  const [isEditingFilename, setIsEditingFilename] = useState(false);
  const [editedFilename, setEditedFilename] = useState(filename);
  const [editorKey, setEditorKey] = useState(Date.now()); // Used to force re-render of editor
  
  // Path info for header display
  const pathInfo = path === '/' ? '/' : path + '/';

  const handleClose = () => {
    // Handled by DraggableWindow component
  };

  const toggleFilenameEdit = () => {
    if (isEditingFilename) {
      // Save the new filename and reload editor
      if (editedFilename !== filename && editedFilename.trim() !== '') {
        // In a real implementation, you'd want to call an API to rename the file
        // For now we just update the state
        setEditorKey(Date.now()); // Force editor reload
      }
    }
    setIsEditingFilename(!isEditingFilename);
  };

  const headerContent = (
    <div className="flex items-center ml-2">
      {isEditingFilename ? (
        <div className="flex items-center">
          <Input
            value={editedFilename}
            onChange={(e) => setEditedFilename(e.target.value)}
            className="w-48 h-6 px-1 py-0 text-xs bg-white/10 border border-white/30 text-white"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') toggleFilenameEdit();
              if (e.key === 'Escape') {
                setEditedFilename(filename);
                toggleFilenameEdit();
              }
            }}
            onBlur={() => {
              setEditedFilename(filename);
              toggleFilenameEdit();
            }}
          />
        </div>
      ) : (
        <Button 
          onClick={toggleFilenameEdit} 
          variant="neutral" 
          size="sm"
          className="h-6 px-1 text-xs border border-white/40 hover:bg-white/20 bg-transparent text-white"
        >
          <Edit2 className="h-3 w-3 mr-1" />
          <span>Rename</span>
        </Button>
      )}
      <span className="text-xs text-white/90 ml-2">
        {pathInfo}
      </span>
    </div>
  );

  return (
    <div className="h-full w-full">
      <NotesWindowEditor 
        key={editorKey}
        initialFilename={filename} 
        initialPath={path}
        onClose={handleClose}
      />
    </div>
  );
};

export default NotesWindowWrapper;