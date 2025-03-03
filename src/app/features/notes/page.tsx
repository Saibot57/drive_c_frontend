'use client';

import React from 'react';
import { Terminal } from '@/components/notes/Terminal';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function NotesPage() {
  return (
    <ProtectedRoute>
      <div className="notes-container">
        <Terminal />
      </div>
    </ProtectedRoute>
  );
}