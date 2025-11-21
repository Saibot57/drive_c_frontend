'use client';
import ProtectedRoute from '@/components/ProtectedRoute';
import NewSchedulePlanner from '@/components/schedule/NewSchedulePlanner';

export default function SchedulePage() {
  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <NewSchedulePlanner />
      </div>
    </ProtectedRoute>
  );
}
