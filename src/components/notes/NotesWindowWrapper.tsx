// src/components/notes/NotesWindowWrapper.tsx
'use client';

import React from 'react';
import NotesWindowEditor from './NotesWindowEditor';
import { useWindowManager } from '@/contexts/WindowContext';

interface NotesWindowWrapperProps {
  filename?: string;
  path?: string;
}

const NotesWindowWrapper: React.FC<NotesWindowWrapperProps> = ({ 
  filename = 'untitled.md',
  path = '/'
}) => {
  const { closeWindow } = useWindowManager();

  const handleClose = () => {
    // We don't actually close the window here as that's handled by the DraggableWindow component
    // This is just for explicit close button inside the editor
  };

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