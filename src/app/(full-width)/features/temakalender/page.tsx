'use client';
import ProtectedRoute from '@/components/ProtectedRoute';
import ThemeWheelPlanner from '@/components/theme-wheel/ThemeWheelPlanner';

export default function TemakalenderPage() {
  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <ThemeWheelPlanner />
      </div>
    </ProtectedRoute>
  );
}
