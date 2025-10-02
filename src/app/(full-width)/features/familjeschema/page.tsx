// src/app/(full-width)/features/familjeschema/page.tsx
'use client';

import { useEffect } from 'react';

import { FamilySchedule } from '@/components/familjeschema/FamilySchedule';
import ProtectedRoute from '@/components/ProtectedRoute';

// Importera CSS-filer för schemat och utskrift
import '@/components/familjeschema/styles/neobrutalism.css';
import '@/components/familjeschema/styles/print.css';

export default function FamilySchedulePage() {
  useEffect(() => {
    document.body.classList.add('family-schedule-body');

    return () => {
      document.body.classList.remove('family-schedule-body');
    };
  }, []);

  return (
    <ProtectedRoute>
      <div className="family-schedule-container">
        <FamilySchedule />
      </div>
    </ProtectedRoute>
  );
}
