// src/app/(full-width)/features/familjeschema/page.tsx
'use client';

import { FamilySchedule } from '@/components/familjeschema/FamilySchedule';
import ProtectedRoute from '@/components/ProtectedRoute';

// Importera CSS-filer för schemat och utskrift
import '@/components/familjeschema/styles/neobrutalism.css';
import '@/components/familjeschema/styles/print.css';

export default function FamilySchedulePage() {
  return (
    <ProtectedRoute>
      <div className="family-schedule-container">
        <FamilySchedule />
      </div>
    </ProtectedRoute>
  );
}
