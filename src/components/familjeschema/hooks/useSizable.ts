import { useEffect } from 'react';
import type { RefObject } from 'react';
import { useLocalStorage } from './useLocalStorage';

export type ModalSize = 'small' | 'medium' | 'large' | 'full';

export const MODAL_SIZES: Record<ModalSize, { width: string; height: string }> = {
  small: { width: '450px', height: '550px' },
  medium: { width: '650px', height: '650px' },
  large: { width: '850px', height: '750px' },
  full: { width: 'min(75vw, 1200px)', height: 'min(75vh, 900px)' },
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

  const element = ref.current;

  useEffect(() => {
    if (!element) return;

    const applySize = () => {
      const { width, height } = MODAL_SIZES[size];
      element.style.width = width;
      element.style.height = height;
    };

    applySize();
    window.addEventListener('resize', applySize);

    return () => {
      window.removeEventListener('resize', applySize);
    };
  }, [element, size]);

  return {
    currentSize: size,
    setSize,
  };
};