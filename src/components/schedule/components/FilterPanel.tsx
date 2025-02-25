'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { Filter } from '../types';

interface FilterPanelProps {
  filter: Filter;
  setFilter: (filter: Filter) => void;
}

export function FilterPanel({ filter, setFilter }: FilterPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const conditions: Array<{ value: Filter['condition']; label: string }> = [
    { value: 'both', label: 'Båda' },
    { value: 'neither', label: 'Ingen' },
    { value: 'x-not-y', label: 'X men inte Y' }
  ];

  const handleConditionChange = (value: string) => {
    setFilter({
      ...filter,
      condition: value as Filter['condition']
    });
  };

  return (
    <Card className="mt-4">
      <CardHeader
        className="cursor-pointer flex flex-row items-center justify-between"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <CardTitle className="text-lg font-monument">Filtrera</CardTitle>
        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium">X (Lärare)</label>
            <Input
              value={filter.label1 || ''}
              onChange={(e) => setFilter({ ...filter, label1: e.target.value })}
              placeholder="Ange lärare..."
              className="schedule-input"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">Y (Lärare)</label>
            <Input
              value={filter.label2 || ''}
              onChange={(e) => setFilter({ ...filter, label2: e.target.value })}
              placeholder="Ange lärare..."
              className="schedule-input"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">Villkor</label>
            <div className="flex flex-wrap gap-2">
              {conditions.map(condition => (
                <button
                  key={condition.value}
                  className={`px-3 py-2 border-2 border-black rounded-lg transition-all ${
                    filter.condition === condition.value 
                      ? 'bg-[#ff6b6b] text-white'
                      : 'bg-white hover:bg-gray-50'
                  }`}
                  onClick={() => handleConditionChange(condition.value)}
                >
                  {condition.label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}