// src/components/notes/NotesWindowWrapper.tsx
'use client';

import React, { useState } from 'react';
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

  const handleClose = () => {
    // We don't actually close the window here as that's handled by the DraggableWindow component
    // This is just for explicit close button inside the editor
  };

  const toggleFilenameEdit = () => {
    setIsEditingFilename(!isEditingFilename);
  };

  const headerContent = (
    <div className="flex items-center ml-4">
      <Button 
        onClick={toggleFilenameEdit} 
        variant="neutral" 
        size="sm"
        className="h-6 px-1 text-xs border border-white/40 hover:bg-white/20 bg-transparent text-white"
      >
        <Edit2 className="h-3 w-3 mr-1" />
        <span>{isEditingFilename ? 'Done' : 'Rename'}</span>
      </Button>
    </div>
  );

  return (
    <div className="h-full w-full">
      <NotesWindowEditor 
        initialFilename={filename} 
        initialPath={path}
        onClose={handleClose}
      />
    </div>
  );
};

export default NotesWindowWrapper;