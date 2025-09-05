// src/app/features/familjeschema/page.tsx
'use client';

import { FamilySchedule } from '@/components/familjeschema/FamilySchedule'; 
import ProtectedRoute from '@/components/ProtectedRoute';

// Importera CSS-filen för schemat
import '@/components/familjeschema/styles/neobrutalism.css'; 

export default function FamilySchedulePage() {
  return (
    <ProtectedRoute>
      <div className="family-schedule-container">
        <FamilySchedule />
      </div>
    </ProtectedRoute>
  );
}