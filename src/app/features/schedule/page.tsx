'use client';

import ScheduleApp from '@/components/schedule/ScheduleApp';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function SchedulePage() {
  return (
    <ProtectedRoute>
      <div className="schedule-container">
        <ScheduleApp />
      </div>
    </ProtectedRoute>
  );
}