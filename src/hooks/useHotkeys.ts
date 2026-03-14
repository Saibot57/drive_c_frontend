import { useEffect, useRef } from 'react';

export type HotkeyBinding = {
  key: string;              // e.g. 'k', 'Escape', 'ArrowDown', '1'
  ctrl?: boolean;
  shift?: boolean;
  handler: (e: KeyboardEvent) => void;
  allowInInput?: boolean;   // default false — suppresses in input/textarea/contentEditable
};

function isEditableElement(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return false;
}

export function useHotkeys(bindings: HotkeyBinding[], deps: unknown[] = []): void {
  const bindingsRef = useRef(bindings);
  bindingsRef.current = bindings;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      for (const binding of bindingsRef.current) {
        const ctrlMatch = binding.ctrl ? (e.ctrlKey || e.metaKey) : !(e.ctrlKey || e.metaKey);
        const shiftMatch = binding.shift ? e.shiftKey : !e.shiftKey;

        if (
          (e.key.toLowerCase() === binding.key.toLowerCase() ||
           (binding.key.length === 1 && /\d/.test(binding.key) && e.code === `Digit${binding.key}`)) &&
          ctrlMatch &&
          shiftMatch
        ) {
          if (!binding.allowInInput && isEditableElement(e.target)) {
            continue;
          }
          e.preventDefault();
          e.stopPropagation();
          binding.handler(e);
          return;
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
