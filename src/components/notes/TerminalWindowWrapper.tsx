// src/components/notes/TerminalWindowWrapper.tsx
'use client';

import React from 'react';
import { Terminal } from './Terminal';

// This wrapper ensures the terminal adapts well to the windowed environment
const TerminalWindowWrapper: React.FC = () => {
  return (
    <div className="h-full w-full flex flex-col">
      <Terminal />
    </div>
  );
};

export default TerminalWindowWrapper;