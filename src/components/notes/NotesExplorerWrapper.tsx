// src/components/notes/NotesExplorerWrapper.tsx
'use client';

import React from 'react';
import NotesExplorer from './NotesExplorer';

const NotesExplorerWrapper: React.FC = () => {
  return (
    <div className="h-full w-full">
      <NotesExplorer />
    </div>
  );
};

export default NotesExplorerWrapper;