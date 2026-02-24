'use client';

import React, { useEffect, useMemo, useRef } from 'react';
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
  const lastAutofillRef = useRef<string | null>(null);

  const normalizedOptions = useMemo(() => (
    options.map(option => ({
      raw: option,
      normalized: normalizeAutofillValue(option)
    }))
  ), [options]);

  useEffect(() => {
    if (lastAutofillRef.current === value) return;

    const segments = value.split(',');
    const lastSegment = segments[segments.length - 1];
    const trimmedSegment = lastSegment.trim();

    if (trimmedSegment.length < minChars) return;

    const query = normalizeAutofillValue(trimmedSegment);
    const matches = normalizedOptions.filter(option => option.normalized.startsWith(query));
    if (matches.length !== 1) return;

    const match = matches[0].raw;
    if (normalizeAutofillValue(match) === query && match === trimmedSegment) return;

    const prefix = segments.slice(0, -1).map(s => s.trim()).join(', ');
    const newValue = prefix ? `${prefix}, ${match}, ` : `${match}, `;

    lastAutofillRef.current = newValue;
    onChange(newValue);
  }, [value, minChars, normalizedOptions, onChange]);

  return (
    <div className="space-y-1">
      <Label htmlFor={fieldId}>{label}</Label>
      <div className="relative">
        <Input
          id={fieldId}
          value={value}
          onChange={event => onChange(event.target.value)}
          onBlur={() => onChange(value.replace(/,\s*$/, ''))}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}
