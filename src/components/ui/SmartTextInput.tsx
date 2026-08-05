'use client';

import React, { useMemo } from 'react';
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

const leadingWhitespace = (value: string) => (
  value.slice(0, value.length - value.trimStart().length)
);

export function SmartTextInput({
  options,
  value,
  onChange,
  minChars = 3,
  fieldId,
  label,
  placeholder
}: SmartTextInputProps) {
  const normalizedOptions = useMemo(() => (
    options.map(option => ({
      raw: option,
      normalized: normalizeAutofillValue(option)
    }))
  ), [options]);

  /**
   * Fyller i resten av namnet när det som skrivits matchar exakt ett
   * alternativ. Fältet kan innehålla flera värden separerade med komma, så
   * bara segmentet efter sista kommat fylls i – allt före lämnas orört,
   * tecken för tecken. Inga kommatecken läggs till.
   */
  const completeLastSegment = (nextValue: string): string => {
    const separatorIndex = nextValue.lastIndexOf(',');
    const lastSegment = nextValue.slice(separatorIndex + 1);
    const trimmedSegment = lastSegment.trim();

    if (trimmedSegment.length < minChars) return nextValue;

    const query = normalizeAutofillValue(trimmedSegment);
    const matches = normalizedOptions.filter(option => option.normalized.startsWith(query));
    if (matches.length !== 1) return nextValue;

    const match = matches[0].raw;
    if (match === trimmedSegment) return nextValue;

    const prefix = nextValue.slice(0, separatorIndex + 1);
    return `${prefix}${leadingWhitespace(lastSegment)}${match}`;
  };

  const handleChange = (nextValue: string) => {
    // Fyll bara i när användaren skriver till tecken. Blir fältet kortare
    // raderar hen, och då ska texten få stå kvar som den är.
    const isTyping = nextValue.length > value.length;
    onChange(isTyping ? completeLastSegment(nextValue) : nextValue);
  };

  return (
    <div className="space-y-1">
      <Label htmlFor={fieldId}>{label}</Label>
      <div className="relative">
        <Input
          id={fieldId}
          value={value}
          onChange={event => handleChange(event.target.value)}
          onBlur={() => onChange(value.replace(/,\s*$/, ''))}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}
