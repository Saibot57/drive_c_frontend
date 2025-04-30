// src/components/window/DraggableWindow.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Maximize2, Minimize2, X, Move, CornerRightDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DraggableWindowProps {
  children: React.ReactNode;
  title: string;
  defaultWidth?: number;
  defaultHeight?: number;
  defaultX?: number;
  defaultY?: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  gridSize?: number;
  zIndex?: number;
  onClose?: () => void;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
}

const DraggableWindow: React.FC<DraggableWindowProps> = ({
  children,
  title,
  defaultWidth = 600,
  defaultHeight = 400,
  defaultX = 50,
  defaultY = 50,
  minWidth = 200,
  minHeight = 200,
  maxWidth = 2000,
  maxHeight = 1200,
  gridSize = 10,
  zIndex = 10,
  onClose,
  className,
  headerClassName,
  contentClassName,
}) => {
  const [position, setPosition] = useState({ x: defaultX, y: defaultY });
  const [dimensions, setDimensions] = useState({ width: defaultWidth, height: defaultHeight });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<string | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [preMaximizeState, setPreMaximizeState] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [showResizeHandles, setShowResizeHandles] = useState(false);

  const windowRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const initialPositionRef = useRef({ x: 0, y: 0 });
  const initialDimensionsRef = useRef({ width: 0, height: 0 });
  const resizeStartRef = useRef({ x: 0, y: 0 });

  // Handle window drag
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only initiate drag from the header
    if (!(e.target as HTMLElement).closest('.window-drag-handle')) return;

    // Prevent text selection during dragging
    e.preventDefault();

    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    initialPositionRef.current = { ...position };
  };

  // Handle resize initiation
  const handleResizeStart = (e: React.MouseEvent, direction: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsResizing(true);
    setResizeDirection(direction);
    resizeStartRef.current = { x: e.clientX, y: e.clientY };
    initialDimensionsRef.current = { ...dimensions };
    initialPositionRef.current = { ...position };
  };

  // Handle maximize/restore
  const toggleMaximize = () => {
    if (!isMaximized) {
      // Save current state before maximizing
      setPreMaximizeState({
        x: position.x,
        y: position.y,
        width: dimensions.width,
        height: dimensions.height
      });

      // Get window dimensions for maximize
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;

      setPosition({ x: 0, y: 0 });
      setDimensions({ width: windowWidth, height: windowHeight });
      setIsMaximized(true);
    } else {
      // Restore previous state
      setPosition({ x: preMaximizeState.x, y: preMaximizeState.y });
      setDimensions({ width: preMaximizeState.width, height: preMaximizeState.height });
      setIsMaximized(false);
    }
  };

  useEffect(() => {
    // Handle mouse move for both dragging and resizing
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const deltaX = e.clientX - dragStartRef.current.x;
        const deltaY = e.clientY - dragStartRef.current.y;
        
        // Calculate new position with grid snapping
        const newX = Math.round((initialPositionRef.current.x + deltaX) / gridSize) * gridSize;
        const newY = Math.round((initialPositionRef.current.y + deltaY) / gridSize) * gridSize;
        
        setPosition({ x: newX, y: newY });
      }
      
      if (isResizing && resizeDirection) {
        e.preventDefault();
        
        const deltaX = e.clientX - resizeStartRef.current.x;
        const deltaY = e.clientY - resizeStartRef.current.y;
        
        let newWidth = initialDimensionsRef.current.width;
        let newHeight = initialDimensionsRef.current.height;
        let newX = initialPositionRef.current.x;
        let newY = initialPositionRef.current.y;
        
        // Apply changes based on resize direction
        if (resizeDirection.includes('e')) {
          newWidth = Math.max(minWidth, Math.min(maxWidth, initialDimensionsRef.current.width + deltaX));
          newWidth = Math.round(newWidth / gridSize) * gridSize;
        }
        
        if (resizeDirection.includes('s')) {
          newHeight = Math.max(minHeight, Math.min(maxHeight, initialDimensionsRef.current.height + deltaY));
          newHeight = Math.round(newHeight / gridSize) * gridSize;
        }
        
        if (resizeDirection.includes('w')) {
          const widthDelta = Math.round(deltaX / gridSize) * gridSize;
          const newPotentialWidth = initialDimensionsRef.current.width - widthDelta;
          
          if (newPotentialWidth >= minWidth && newPotentialWidth <= maxWidth) {
            newWidth = newPotentialWidth;
            newX = initialPositionRef.current.x + widthDelta;
          }
        }
        
        if (resizeDirection.includes('n')) {
          const heightDelta = Math.round(deltaY / gridSize) * gridSize;
          const newPotentialHeight = initialDimensionsRef.current.height - heightDelta;
          
          if (newPotentialHeight >= minHeight && newPotentialHeight <= maxHeight) {
            newHeight = newPotentialHeight;
            newY = initialPositionRef.current.y + heightDelta;
          }
        }
        
        // Update state
        setDimensions({ width: newWidth, height: newHeight });
        setPosition({ x: newX, y: newY });
      }
    };

    // Handle mouse up to end dragging/resizing
    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      setResizeDirection(null);
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, resizeDirection, gridSize, minWidth, minHeight, maxWidth, maxHeight]);

  // Focus window on click
  const handleWindowClick = () => {
    // This would be used in a multi-window system to bring this window to front
    // Would need to be implemented through a WindowManager context
  };

  return (
    <div
      ref={windowRef}
      className={cn(
        'absolute neo-brutalist-card overflow-hidden',
        className
      )}
      style={{
        width: `${dimensions.width}px`,
        height: `${dimensions.height}px`,
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex,
        transform: 'translate(0, 0)', // Used to enable GPU acceleration
      }}
      onClick={handleWindowClick}
      onMouseEnter={() => setShowResizeHandles(true)}
      onMouseLeave={() => setShowResizeHandles(false)}
    >
      {/* Window resize handles - now with hover states */}
      <div 
        className={`
          absolute top-0 left-0 w-4 h-4 cursor-nwse-resize z-20
          transition-colors duration-200
          ${showResizeHandles ? 'bg-black/10' : 'bg-transparent'}
        `}
        onMouseDown={(e) => handleResizeStart(e, 'nw')}
      />
      <div 
        className={`
          absolute top-0 right-0 w-4 h-4 cursor-nesw-resize z-20
          transition-colors duration-200
          ${showResizeHandles ? 'bg-black/10' : 'bg-transparent'}
        `}
        onMouseDown={(e) => handleResizeStart(e, 'ne')}
      />
      <div 
        className={`
          absolute bottom-0 left-0 w-4 h-4 cursor-nesw-resize z-20
          transition-colors duration-200
          ${showResizeHandles ? 'bg-black/10' : 'bg-transparent'}
        `}
        onMouseDown={(e) => handleResizeStart(e, 'sw')}
      />
      
      {/* Prominent bottom-right resize handle */}
      <div 
        className={`
          absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize z-30
          flex items-center justify-center
          border-l-2 border-t-2 border-black bg-white
          transition-opacity duration-200
          ${showResizeHandles ? 'opacity-100' : 'opacity-40'}
        `}
        onMouseDown={(e) => handleResizeStart(e, 'se')}
      >
        <CornerRightDown className="h-4 w-4 text-black/70" />
      </div>
      
      {/* Edge resize handles with hover effects */}
      <div 
        className={`
          absolute top-0 left-4 right-4 h-3 cursor-ns-resize z-20
          transition-colors duration-200
          ${showResizeHandles ? 'bg-black/5' : 'bg-transparent'}
        `}
        onMouseDown={(e) => handleResizeStart(e, 'n')}
      />
      <div 
        className={`
          absolute bottom-0 left-6 right-6 h-3 cursor-ns-resize z-20
          transition-colors duration-200
          ${showResizeHandles ? 'bg-black/5' : 'bg-transparent'}
        `}
        onMouseDown={(e) => handleResizeStart(e, 's')}
      />
      <div 
        className={`
          absolute left-0 top-4 bottom-4 w-3 cursor-ew-resize z-20
          transition-colors duration-200
          ${showResizeHandles ? 'bg-black/5' : 'bg-transparent'}
        `}
        onMouseDown={(e) => handleResizeStart(e, 'w')}
      />
      <div 
        className={`
          absolute right-0 top-4 bottom-6 w-3 cursor-ew-resize z-20
          transition-colors duration-200
          ${showResizeHandles ? 'bg-black/5' : 'bg-transparent'}
        `}
        onMouseDown={(e) => handleResizeStart(e, 'e')}
      />

      {/* Window header */}
      <div
        className={cn(
          'window-drag-handle flex items-center justify-between p-2 bg-[#ff6b6b] border-b-2 border-black h-10 text-white',
          headerClassName
        )}
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <Move className="h-4 w-4 cursor-move" />
          <h3 className="font-monument text-sm truncate">{title}</h3>
        </div>
        <div className="flex gap-2">
          <button
            className="h-6 w-6 flex items-center justify-center hover:bg-black/10 rounded-sm transition-colors"
            onClick={toggleMaximize}
          >
            {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          {onClose && (
            <button
              className="h-6 w-6 flex items-center justify-center hover:bg-black/10 rounded-sm transition-colors"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Window content */}
      <div 
        className={cn(
          'neo-brutalist-content w-full overflow-auto',
          contentClassName
        )}
        style={{ height: `calc(100% - 40px)` }}
      >
        {children}
      </div>
    </div>
  );
};

export default DraggableWindow;