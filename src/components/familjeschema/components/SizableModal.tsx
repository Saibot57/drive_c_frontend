import React, { forwardRef, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useSizable, type ModalSize } from '../hooks/useSizable';
import { Square, StretchHorizontal, StretchVertical, Maximize2 } from 'lucide-react';

interface SizableModalProps {
  children: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  storageKey: string;
  initialSize?: ModalSize;
  forcedSize?: ModalSize;
  enableSizeControls?: boolean;
}

export const SizableModal = forwardRef<HTMLDivElement, SizableModalProps>(
  ({
    children,
    isOpen,
    onClose,
    storageKey,
    initialSize = 'medium',
    forcedSize,
    enableSizeControls = true
  }, ref) => {

    const modalRef = useRef<HTMLDivElement>(null);
    React.useImperativeHandle(ref, () => modalRef.current as HTMLDivElement);

    const { currentSize, setSize } = useSizable(modalRef as React.RefObject<HTMLElement>, {
      storageKey,
      initialSize,
      isEnabled: isOpen,
    });

    useEffect(() => {
      if (!forcedSize || !isOpen) {
        return;
      }

      setSize((prevSize) => (prevSize === forcedSize ? prevSize : forcedSize));
    }, [forcedSize, isOpen, setSize]);

    if (!isOpen) return null;

    const handleOverlayClick = (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    };

    const sizeButtons: { size: ModalSize; icon: ReactNode; label: string }[] = [
        { size: 'small', icon: <Square size={18}/>, label: 'Liten' },
        { size: 'medium', icon: <StretchHorizontal size={18}/>, label: 'Medium' },
        { size: 'large', icon: <StretchVertical size={18}/>, label: 'Stor' },
        { size: 'full', icon: <Maximize2 size={18}/>, label: 'Jättestor' },
    ];

    return (
      <div
        className="modal-overlay"
        onClick={handleOverlayClick}
      >
        <div
          className="modal sizable-modal"
          ref={modalRef}
        >
          {/* Size Controls */}
          {enableSizeControls && (
            <div className="modal-size-controls">
              {sizeButtons.map(({ size, icon, label }) => (
                <button
                  key={size}
                  className={`btn-size ${currentSize === size ? 'active' : ''}`}
                  onClick={() => setSize(size)}
                  aria-label={`Byt till ${label} storlek`}
                  title={label}
                >
                  {icon}
                </button>
              ))}
            </div>
          )}

          {children}
        </div>
      </div>
    );
  }
);

SizableModal.displayName = 'SizableModal';