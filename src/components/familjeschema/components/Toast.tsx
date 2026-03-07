import React from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react';
import type { Toast as ToastType } from '../hooks/useToast';

interface ToastContainerProps {
  toasts: ToastType[];
  onRemove: (id: number) => void;
}

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
} as const;

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
  if (!toasts.length) return null;

  return (
    <div className="neo-toast-container">
      {toasts.map(toast => {
        const Icon = icons[toast.variant];
        return (
          <div key={toast.id} className={`neo-toast neo-toast--${toast.variant}`} role="alert">
            <Icon size={18} className="neo-toast__icon" />
            <div className="neo-toast__body">
              <span className="neo-toast__message">{toast.message}</span>
              {toast.detail && (
                <pre className="neo-toast__detail">{toast.detail}</pre>
              )}
            </div>
            <button
              className="neo-toast__close"
              onClick={() => onRemove(toast.id)}
              aria-label="Stäng"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
