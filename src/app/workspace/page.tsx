// src/app/workspace/page.tsx
'use client';

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { WindowProvider, useWindowManager } from '@/contexts/WindowContext';
import TerminalWindowWrapper from '@/components/notes/TerminalWindowWrapper';
import { Terminal as TerminalIcon } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';

const WindowControlButtons = () => {
  const { openWindow } = useWindowManager();

  return (
    <div className="fixed bottom-4 left-4 flex gap-2 z-50">
      <Button 
        onClick={() => openWindow('terminal', <TerminalWindowWrapper />, 'Terminal', {
          dimensions: { width: 800, height: 600 },
          position: { x: 50, y: 50 }
        })}
        className="flex items-center gap-2 bg-[#ff6b6b] text-white border-2 border-black"
      >
        <TerminalIcon className="h-4 w-4" />
        <span>Terminal</span>
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
              className="fixed bottom-4 right-4 bg-white border-2 border-black"
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