import { useEffect } from 'react';

type FocusTrapRef = { current: HTMLElement | null };

export const useFocusTrap = (ref: FocusTrapRef, isActive: boolean): void => {
  useEffect(() => {
    const element = ref.current;
    if (!isActive || !element) return;

    const focusableElements = element.querySelectorAll<HTMLElement>(
      'a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || focusableElements.length === 0) return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    element.addEventListener('keydown', handleTabKey);
    firstElement?.focus();

    return () => element.removeEventListener('keydown', handleTabKey);
  }, [ref, isActive]);
};