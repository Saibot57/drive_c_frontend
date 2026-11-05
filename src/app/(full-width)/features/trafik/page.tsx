'use client';
import ProtectedRoute from '@/components/ProtectedRoute';
import TrafficDashboard from '@/components/traffic/TrafficDashboard';

export default function TrafikPage() {
  return (
    <ProtectedRoute>
      <TrafficDashboard />
    </ProtectedRoute>
  );
}
