'use client';
import ProtectedRoute from '@/components/ProtectedRoute';
import LessonLab from '@/components/lesson-lab/LessonLab';

export default function VeckolabbPage() {
  return (
    <ProtectedRoute>
      <LessonLab />
    </ProtectedRoute>
  );
}
