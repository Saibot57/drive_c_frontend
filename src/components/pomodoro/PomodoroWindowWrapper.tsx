// src/components/pomodoro/PomodoroWindowWrapper.tsx
'use client';

import React from 'react';
import { PomodoroTimer } from './PomodoroTimer';

// This wrapper ensures the pomodoro timer adapts well to the windowed environment
const PomodoroWindowWrapper: React.FC = () => {
  return (
    <div className="h-full w-full flex flex-col">
      <PomodoroTimer />
    </div>
  );
};

export default PomodoroWindowWrapper;