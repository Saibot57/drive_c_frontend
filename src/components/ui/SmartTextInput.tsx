'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AUTOFILL_DISABLE_WINDOW_MS } from '@/components/schedule/constants';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type SmartTextInputProps = {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  minChars?: number;
  fieldId: string;
  label: string;
  placeholder?: string;
};

const normalizeAutofillValue = (value: string) => (
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
);

export function SmartTextInput({
  options,
  value,
  onChange,
  minChars = 2,
  fieldId,
  label,
  placeholder
}: SmartTextInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [autoDisabled, setAutoDisabled] = useState(false);
  const backspaceJustPressedRef = useRef(false);
  const lastAutofillAtRef = useRef<number | null>(null);
  const lastAutofillValueRef = useRef<string | null>(null);
  const lastTypedPrefixLengthRef = useRef<number | null>(null);
  const pendingSelectionRef = useRef<{ start: number; end: number } | null>(null);
  const suffixSelectionRef = useRef(false);

  const normalizedOptions = useMemo(() => (
    options.map(option => ({
      raw: option,
      normalized: normalizeAutofillValue(option)
    }))
  ), [options]);

  useEffect(() => {
    const query = normalizeAutofillValue(value);
    if (autoDisabled) return;
    if (backspaceJustPressedRef.current) {
      backspaceJustPressedRef.current = false;
      return;
    }
    if (query.length < minChars) return;
    const matches = normalizedOptions.filter(option => option.normalized.startsWith(query));
    if (matches.length !== 1) return;
    const match = matches[0].raw;
    if (value === match) return;
    const prefixLength = value.length;
    lastTypedPrefixLengthRef.current = prefixLength;
    lastAutofillAtRef.current = Date.now();
    lastAutofillValueRef.current = match;
    pendingSelectionRef.current = { start: prefixLength, end: match.length };
    onChange(match);
  }, [autoDisabled, minChars, normalizedOptions, onChange, value]);

  useLayoutEffect(() => {
    if (!pendingSelectionRef.current) return;
    if (!inputRef.current) return;
    if (value !== lastAutofillValueRef.current) return;
    const { start, end } = pendingSelectionRef.current;
    inputRef.current.setSelectionRange(start, end);
    pendingSelectionRef.current = null;
  }, [value]);

  const shouldDisableAutofill = () => {
    if (!lastAutofillAtRef.current || !lastAutofillValueRef.current) return false;
    if (Date.now() - lastAutofillAtRef.current > AUTOFILL_DISABLE_WINDOW_MS) return false;
    return value === lastAutofillValueRef.current;
  };

  return (
    <div className="space-y-1">
      <Label htmlFor={fieldId}>{label}</Label>
      <div className="relative">
        <Input
          id={fieldId}
          ref={inputRef}
          value={value}
          onChange={event => {
            if (shouldDisableAutofill()) {
              setAutoDisabled(true);
            }
            onChange(event.target.value);
            if (suffixSelectionRef.current) {
              const nextValue = event.target.value;
              requestAnimationFrame(() => {
                inputRef.current?.setSelectionRange(nextValue.length, nextValue.length);
              });
              suffixSelectionRef.current = false;
            }
          }}
          onKeyDown={event => {
            if (event.key === 'Backspace') {
              backspaceJustPressedRef.current = true;
            }
            if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
              if (shouldDisableAutofill()) {
                setAutoDisabled(true);
                const input = inputRef.current;
                const prefixLength = lastTypedPrefixLengthRef.current ?? 0;
                if (input && input.selectionStart === prefixLength && input.selectionEnd === value.length) {
                  suffixSelectionRef.current = true;
                }
              }
            }
          }}
          onBlur={() => setAutoDisabled(false)}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}
