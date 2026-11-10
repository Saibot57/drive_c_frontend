'use client';
import ProtectedRoute from '@/components/ProtectedRoute';
import Mindmap from '@/components/mindmap/Mindmap';

export default function MindmapPage() {
  return (
    <ProtectedRoute>
      <Mindmap />
    </ProtectedRoute>
  );
}
