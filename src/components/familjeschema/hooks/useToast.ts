import { useState, useCallback, useRef } from 'react';

export type ToastVariant = 'success' | 'error' | 'warning';

export interface Toast {
  id: number;
  variant: ToastVariant;
  message: string;
  detail?: string;
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const addToast = useCallback((variant: ToastVariant, message: string, detail?: string) => {
    const id = nextId.current++;
    setToasts(prev => [...prev, { id, variant, message, detail }]);

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
}
