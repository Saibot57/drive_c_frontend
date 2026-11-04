'use client';
import ProtectedRoute from '@/components/ProtectedRoute';
import Narvaro from '@/components/narvaro/Narvaro';

export default function NarvaroPage() {
  return (
    <ProtectedRoute>
      <Narvaro />
    </ProtectedRoute>
  );
}
