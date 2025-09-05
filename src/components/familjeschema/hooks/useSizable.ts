import { useEffect, useCallback } from 'react';
import type { RefObject } from 'react';
import { useLocalStorage } from './useLocalStorage';

export type ModalSize = 'small' | 'medium' | 'large';

export const MODAL_SIZES: Record<ModalSize, { width: string; height: string }> = {
  small: { width: '450px', height: '550px' },
  medium: { width: '650px', height: '650px' },
  large: { width: '850px', height: '750px' },
};

interface UseSizableOptions {
  storageKey: string;
  initialSize?: ModalSize;
}

export const useSizable = (
  ref: RefObject<HTMLElement>,
  options: UseSizableOptions
) => {
  const { storageKey, initialSize = 'medium' } = options;
  const [size, setSize] = useLocalStorage<ModalSize>(`sizable-${storageKey}`, initialSize);

  const applySize = useCallback(() => {
    if (ref.current) {
      const { width, height } = MODAL_SIZES[size];
      ref.current.style.width = width;
      ref.current.style.height = height;
    }
  }, [ref, size]);

  useEffect(() => {
    applySize();
    window.addEventListener('resize', applySize);
    return () => window.removeEventListener('resize', applySize);
  }, [size, applySize]);

  return {
    currentSize: size,
    setSize,
  };
};