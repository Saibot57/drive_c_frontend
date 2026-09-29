'use client';
import ProtectedRoute from '@/components/ProtectedRoute';
import TermPlanner from '@/components/term-planner/TermPlanner';

export default function TerminPage() {
  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <TermPlanner />
      </div>
    </ProtectedRoute>
  );
}
