import type React from 'react';

/** Skriver användaren i ett fält just nu? Då ska kortkommandon släppa tangenten. */
export function isEditableElement(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return el.isContentEditable;
}

/** Ctrl+Enter (Cmd+Enter på Mac) skickar formuläret, även från ett textfält. */
export const submitOnCtrlEnter = (submit: (event: React.FormEvent) => void) =>
  (event: React.KeyboardEvent<HTMLFormElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      submit(event as unknown as React.FormEvent);
    }
  };
