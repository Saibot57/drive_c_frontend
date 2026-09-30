'use client';
import ProtectedRoute from '@/components/ProtectedRoute';
import LessonLab from '@/components/lesson-lab/LessonLab';

export default function ArbetslagPage() {
  return (
    <ProtectedRoute>
      <LessonLab />
    </ProtectedRoute>
  );
}
