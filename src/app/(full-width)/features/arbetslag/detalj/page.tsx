'use client';
import ProtectedRoute from '@/components/ProtectedRoute';
import LessonLabDetail from '@/components/lesson-lab/LessonLabDetail';

export default function DetaljplanPage() {
  return (
    <ProtectedRoute>
      <LessonLabDetail />
    </ProtectedRoute>
  );
}
