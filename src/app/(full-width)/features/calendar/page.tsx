'use client';

import ProtectedRoute from '@/components/ProtectedRoute';
import CalendarShell from '@/components/month-calendar/CalendarShell';

export default function CalendarPage() {
  return (
    <ProtectedRoute>
      <CalendarShell />
    </ProtectedRoute>
  );
}
