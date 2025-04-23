// src/app/workspace/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { WindowProvider, useWindowManager } from '@/contexts/WindowContext';
import TerminalWindowWrapper from '@/components/notes/TerminalWindowWrapper';
import TodoWindowWrapper from '@/components/todo/TodoWindowWrapper';
import PomodoroWindowWrapper from '@/components/pomodoro/PomodoroWindowWrapper';
import { Terminal as TerminalIcon, ListTodo, Timer, FileText } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import FileSectionsDropdown from '@/components/FileList/FileSectionsDropdown';
import dynamic from 'next/dynamic';

// Dynamically import FileListWindowWrapper to avoid potential circular dependencies
// Use a relative import path for FileListWindowWrapper since the alias path isn't working
const FileListWindowWrapper = dynamic(() => import('@/components/FileList/FileListWindowWrapper'), {
  loading: () => <p>Loading...</p>,
});

const WindowControlButtons = () => {
  const { openWindow } = useWindowManager();
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1000,
    height: typeof window !== 'undefined' ? window.innerHeight : 800
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSectionSelect = (section: any) => {
    // Open a new window with the selected section
    openWindow(
      `file-section-${section.id}`, 
      <FileListWindowWrapper initialData={section.data} />, 
      `Files: ${section.name}`, 
      {
        dimensions: { width: 600, height: 500 },
        position: { x: 150, y: 100 }
      }
    );
  };

  return (
    <div className="fixed bottom-4 left-4 flex gap-2 z-50">
      <Button 
        onClick={() => openWindow('terminal', <TerminalWindowWrapper />, 'Terminal', {
          dimensions: { width: 800, height: 600 },
          position: { x: 50, y: 50 }
        })}
        className="flex items-center gap-2 bg-main text-mtext border-2 border-border"
      >
        <TerminalIcon className="h-4 w-4" />
        <span>Terminal</span>
      </Button>
      
      <Button 
        onClick={async () => {
          // Dynamically import NotesExplorerWrapper to avoid circular dependencies
          const { default: NotesExplorerWrapper } = await import('@/components/notes/NotesExplorerWrapper');
          
          openWindow('notes-explorer', <NotesExplorerWrapper />, 'Notes Explorer', {
            dimensions: { width: 500, height: 600 },
            position: { x: 100, y: 100 }
          });
        }}
        className="flex items-center gap-2 bg-main text-mtext border-2 border-border"
      >
        <FileText className="h-4 w-4" />
        <span>Notes</span>
      </Button>

      {/* New Files dropdown button */}
      <FileSectionsDropdown onSectionSelect={handleSectionSelect} />
      
      <Button 
        onClick={() => openWindow('todo', <TodoWindowWrapper />, 'Todo List', {
          dimensions: { width: 300, height: 400 },
          position: { 
            x: Math.max(50, windowSize.width - 350),  // Bottom right positioning
            y: Math.max(50, windowSize.height - 450)
          }
        })}
        className="flex items-center gap-2 bg-main text-mtext border-2 border-border"
      >
        <ListTodo className="h-4 w-4" />
        <span>Todo</span>
      </Button>
      
      <Button 
        onClick={() => openWindow('pomodoro', <PomodoroWindowWrapper />, 'Pomodoro Timer', {
          dimensions: { width: 350, height: 500 },
          position: { 
            x: Math.max(50, windowSize.width / 2 - 175),  // Center positioning
            y: Math.max(50, windowSize.height / 2 - 250)
          }
        })}
        className="flex items-center gap-2 bg-main text-mtext border-2 border-border"
      >
        <Timer className="h-4 w-4" />
        <span>Pomodoro</span>
      </Button>
    </div>
  );
};

// Grid overlay for development purposes
const GridOverlay = ({ size = 10, visible = false }) => {
  if (!visible) return null;
  
  return (
    <div 
      className="fixed inset-0 pointer-events-none z-0"
      style={{
        backgroundImage: `
          linear-gradient(to right, rgba(0, 0, 0, 0.1) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(0, 0, 0, 0.1) 1px, transparent 1px)
        `,
        backgroundSize: `${size}px ${size}px`
      }}
    />
  );
};

const WorkspacePage = () => {
  const [showGrid, setShowGrid] = useState(false);
  
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#fcd7d7] overflow-hidden">
        <WindowProvider>
          {/* Main content area where windows will be rendered */}
          <div className="relative w-full h-screen">
            <GridOverlay size={10} visible={showGrid} />
            <WindowControlButtons />
            
            {/* Grid toggle button */}
            <Button
              className="fixed bottom-4 right-4 bg-white border-2 border-border"
              onClick={() => setShowGrid(!showGrid)}
            >
              {showGrid ? 'Hide Grid' : 'Show Grid'}
            </Button>
          </div>
        </WindowProvider>
      </div>
    </ProtectedRoute>
  );
};

export default WorkspacePage;