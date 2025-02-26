'use client';

import React from 'react';
import { Search } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface SearchPanelProps {
  onSearch: (searchCriteria: any) => void;
}

export function SearchPanel({ onSearch }: SearchPanelProps) {
  const [searchText, setSearchText] = React.useState('');

  const parseSearchText = (text: string) => {
    // Split by semicolon for individual search terms
    const terms = text.split(';').map(term => term.trim()).filter(Boolean);
    
    return terms.map(term => {
      // Check if the term contains a combination (marked by +)
      if (term.includes('+')) {
        return {
          type: 'combination' as const,
          terms: term.split('+').map(t => t.trim()).filter(Boolean)
        };
      }
      return {
        type: 'single' as const,
        terms: [term]
      };
    });
  };

  const handleSearch = (value: string) => {
    setSearchText(value);
    const searchCriteria = parseSearchText(value);
    onSearch(searchCriteria);
  };

  return (
    <Card className="mt-4 mb-4">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-monument">Sök i schemat</CardTitle>
        <Search className="h-4 w-4 text-gray-500" />
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="relative">
            <Input
              value={searchText}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Ex: Tobias; Anna eller Tema A + Tobias"
              className="schedule-input pl-10"
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          </div>
          <p className="text-sm text-gray-500">
            Använd semikolon (;) för separata sökningar och plus (+) för att kombinera termer
          </p>
        </div>
      </CardContent>
    </Card>
  );
}