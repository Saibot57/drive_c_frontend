'use client';

import React from 'react';
import { Plus, X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type TriggerRule = { id: string; word: string };

type TriggerRuleListProps<R extends TriggerRule> = {
  rules: R[];
  onChange: (next: R[]) => void;
  /** En ny, tom regel utan id. */
  createRule: () => Omit<R, 'id'>;
  emptyText: string;
  addLabel: string;
  wordPlaceholder: string;
  wordAriaLabel: (index: number) => string;
  removeAriaLabel: (index: number) => string;
  /** Fältet för det regeln sätter, t.ex. en färg eller en sal. */
  renderValue: (rule: R, index: number, update: (patch: Partial<R>) => void) => React.ReactNode;
  /** Takhöjden för listan innan den börjar scrolla. */
  listClassName: string;
  /** Renderas före listan, t.ex. en datalist som fälten pekar på. */
  children?: React.ReactNode;
};

/**
 * Regler av typen "ord i titeln → något". Färg- och salsreglerna ser likadana
 * ut och skiljer sig bara i fältet till höger om ordet.
 */
export function TriggerRuleList<R extends TriggerRule>({
  rules,
  onChange,
  createRule,
  emptyText,
  addLabel,
  wordPlaceholder,
  wordAriaLabel,
  removeAriaLabel,
  renderValue,
  listClassName,
  children,
}: TriggerRuleListProps<R>) {
  const update = (id: string, patch: Partial<R>) => {
    onChange(rules.map(rule => (rule.id === id ? { ...rule, ...patch } : rule)));
  };

  return (
    /* Storleken följer innehållet i stället för att ta resten av kolumnen, och
       `shrink-0` hindrar att den krymps ihop igen: med tre sektioner under
       varandra räcker höjden inte till, och utan spärren pressas knappen nedan
       ut ur sin ruta och lägger sig ovanpå nästa rubrik. Kolumnen scrollar. */
    <div className="flex min-h-0 shrink-0 flex-col gap-2">
      {children}

      {rules.length === 0 ? (
        <p className="text-sm text-gray-500 italic">{emptyText}</p>
      ) : (
        <div className={`${listClassName} min-h-0 space-y-2 overflow-y-auto pr-1`}>
          {rules.map((rule, index) => (
            <div key={rule.id} className="flex items-center gap-2">
              <span className="w-5 shrink-0 text-xs font-bold text-gray-400">{index + 1}</span>
              <Input
                value={rule.word}
                onChange={event => update(rule.id, { word: event.target.value } as Partial<R>)}
                placeholder={wordPlaceholder}
                aria-label={wordAriaLabel(index)}
                className="flex-1"
              />
              {renderValue(rule, index, patch => update(rule.id, patch))}
              <Button
                type="button"
                size="sm"
                variant="neutral"
                className="h-8 w-8 shrink-0 p-0"
                aria-label={removeAriaLabel(index)}
                onClick={() => onChange(rules.filter(item => item.id !== rule.id))}
              >
                <X size={14} />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Button
        type="button"
        size="sm"
        variant="neutral"
        className="shrink-0 self-start"
        onClick={() => onChange([...rules, { ...createRule(), id: uuidv4() } as R])}
      >
        <Plus size={14} className="mr-1" /> {addLabel}
      </Button>
    </div>
  );
}
