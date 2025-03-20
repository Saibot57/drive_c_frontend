// src/contexts/WindowContext.tsx
'use client';

import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import DraggableWindow from '@/components/window/DraggableWindow';

export interface WindowState {
  id: string;
  component: ReactNode;
  title: string;
  isOpen: boolean;
  zIndex: number;
  position: { x: number; y: number };
  dimensions: { width: number; height: number };
  minimized: boolean;
  maximized: boolean;
}

interface WindowContextType {
  windows: WindowState[];
  openWindow: (id: string, component: ReactNode, title: string, options?: Partial<WindowState>) => void;
  closeWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  maximizeWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  updateWindowPosition: (id: string, position: { x: number; y: number }) => void;
  updateWindowDimensions: (id: string, dimensions: { width: number; height: number }) => void;
}

const WindowContext = createContext<WindowContextType | null>(null);

export const useWindowManager = () => {
  const context = useContext(WindowContext);
  if (!context) {
    throw new Error('useWindowManager must be used within a WindowProvider');
  }
  return context;
};

interface WindowProviderProps {
  children: ReactNode;
}

const localStorageKey = 'window-states';

export const WindowProvider: React.FC<WindowProviderProps> = ({ children }) => {
  const [windows, setWindows] = useState<WindowState[]>([]);
  const [highestZIndex, setHighestZIndex] = useState(100);

  // Load window states from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedStates = localStorage.getItem(localStorageKey);
      if (savedStates) {
        try {
          // Only load position and dimension data, not the actual components
          const parsedStates = JSON.parse(savedStates);
          // We don't restore windows here - we just save the states for components
          // to access when they initialize
        } catch (e) {
          console.error('Error parsing saved window states:', e);
        }
      }
    }
  }, []);

  // Save window states to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && windows.length > 0) {
      // Only save the necessary state data, not the React components
      const stateToSave = windows.map(({ id, title, isOpen, position, dimensions, minimized, maximized }) => ({
        id,
        title,
        isOpen,
        position,
        dimensions,
        minimized,
        maximized,
      }));
      localStorage.setItem(localStorageKey, JSON.stringify(stateToSave));
    }
  }, [windows]);

  const openWindow = (
    id: string,
    component: ReactNode,
    title: string,
    options?: Partial<WindowState>
  ) => {
    // Check if window already exists
    const existingWindowIndex = windows.findIndex(w => w.id === id);

    if (existingWindowIndex >= 0) {
      // Window exists, update it and bring to front
      setWindows(prev => {
        const updatedWindows = [...prev];
        updatedWindows[existingWindowIndex] = {
          ...updatedWindows[existingWindowIndex],
          isOpen: true,
          minimized: false,
          zIndex: highestZIndex + 1,
          ...options
        };
        return updatedWindows;
      });
      setHighestZIndex(prev => prev + 1);
    } else {
      // Create new window
      const newZIndex = highestZIndex + 1;
      setWindows(prev => [
        ...prev,
        {
          id,
          component,
          title,
          isOpen: true,
          zIndex: newZIndex,
          position: options?.position || { x: 50 + (prev.length * 20), y: 50 + (prev.length * 20) },
          dimensions: options?.dimensions || { width: 800, height: 600 },
          minimized: false,
          maximized: false,
          ...options
        }
      ]);
      setHighestZIndex(newZIndex);
    }
  };

  const closeWindow = (id: string) => {
    setWindows(prev => prev.map(window => 
      window.id === id ? { ...window, isOpen: false } : window
    ));
  };

  const minimizeWindow = (id: string) => {
    setWindows(prev => prev.map(window => 
      window.id === id ? { ...window, minimized: true } : window
    ));
  };

  const maximizeWindow = (id: string) => {
    setWindows(prev => prev.map(window => 
      window.id === id ? { ...window, maximized: true, minimized: false } : window
    ));
  };

  const restoreWindow = (id: string) => {
    setWindows(prev => prev.map(window => 
      window.id === id ? { ...window, minimized: false, maximized: false } : window
    ));
  };

  const focusWindow = (id: string) => {
    setWindows(prev => {
      const newZIndex = highestZIndex + 1;
      return prev.map(window => 
        window.id === id 
          ? { ...window, zIndex: newZIndex, minimized: false }
          : window
      );
    });
    setHighestZIndex(prev => prev + 1);
  };

  const updateWindowPosition = (id: string, position: { x: number; y: number }) => {
    setWindows(prev => prev.map(window => 
      window.id === id ? { ...window, position } : window
    ));
  };

  const updateWindowDimensions = (id: string, dimensions: { width: number; height: number }) => {
    setWindows(prev => prev.map(window => 
      window.id === id ? { ...window, dimensions } : window
    ));
  };

  return (
    <WindowContext.Provider
      value={{
        windows,
        openWindow,
        closeWindow,
        minimizeWindow,
        maximizeWindow,
        restoreWindow,
        focusWindow,
        updateWindowPosition,
        updateWindowDimensions,
      }}
    >
      {children}
      <WindowManager />
    </WindowContext.Provider>
  );
};

// WindowManager Component
export const WindowManager: React.FC = () => {
  const { windows, closeWindow, focusWindow, updateWindowPosition, updateWindowDimensions } = useWindowManager();

  return (
    <>
      {windows.filter(window => window.isOpen && !window.minimized).map((window) => (
        <DraggableWindow
          key={window.id}
          title={window.title}
          defaultWidth={window.dimensions.width}
          defaultHeight={window.dimensions.height}
          defaultX={window.position.x}
          defaultY={window.position.y}
          zIndex={window.zIndex}
          onClose={() => closeWindow(window.id)}
          className="window-container"
        >
          {window.component}
        </DraggableWindow>
      ))}
    </>
  );
};