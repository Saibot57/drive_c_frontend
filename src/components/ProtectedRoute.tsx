'use client';

import React, { useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
}

// Add explicit export default here
export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Only redirect after we've confirmed the user isn't authenticated and loading is done
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // Show nothing while loading
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-t-accent-soft">
        <div className="bg-t-card p-6 rounded-xl border-2 border-t-border shadow-neo">
          <p className="text-xl font-monument">Laddar…</p>
        </div>
      </div>
    );
  }

  // If authenticated, render children
  return isAuthenticated ? <>{children}</> : null;
}