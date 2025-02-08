'use client';

import React from 'react';
import { Input } from "@/components/ui/input";
import { Search as SearchIcon } from "lucide-react";

interface SearchProps {
  onSearch: (term: string) => void;
}

export const Search: React.FC<SearchProps> = ({ onSearch }) => {
  return (
    <div className="relative w-full max-w-xl mx-auto">
      <Input
        type="text"
        placeholder="..."
        className="pl-10 h-12 border-2 border-black rounded-xl bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
        onChange={(e) => onSearch(e.target.value)}
      />
      <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-black-500" />
    </div>
  );
};