// src/app/features/calendar/page.tsx
'use client';

import { Calendar } from "@/components/calendar/Calendar";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function CalendarPage() {
  return (
    <ProtectedRoute>
      <div className="calendar-container">
        <Calendar />
      </div>
    </ProtectedRoute>
  );
}