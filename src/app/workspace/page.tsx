'use client';
import ProtectedRoute from '@/components/ProtectedRoute';
import { FeatureNavigation } from '@/components/FeatureNavigation';

export default function WorkspacePage() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen">
        <div className="fixed top-4 left-4 z-50">
          <FeatureNavigation />
        </div>
        {/* Ny feature monteras här */}
      </div>
    </ProtectedRoute>
  );
}
