// src/components/FileList/FileSectionsDropdown.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, FolderOpen, X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { fetchWithAuth } from '@/services/authService';

interface SectionItem {
  name: string;
  id: string;
  data: any;
}

interface FileSectionsDropdownProps {
  onSectionSelect: (section: SectionItem) => void;
}

const FileSectionsDropdown: React.FC<FileSectionsDropdownProps> = ({ onSectionSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://tobiaslundh1.pythonanywhere.com/api';

  // Fetch available sections
  useEffect(() => {
    const fetchSections = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetchWithAuth(`${API_URL}/files`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const json = await response.json();
        
        // Transform the data for dropdown use
        const sectionsData = json.data.map((section: any) => ({
          name: section.name,
          id: section.name.toLowerCase().replace(/\s+/g, '-'),
          data: section
        }));
        
        setSections(sectionsData);
      } catch (e: any) {
        console.error("Fetch error:", e);
        setError('Failed to load sections.');
      } finally {
        setLoading(false);
      }
    };

    // Only fetch when the dropdown is opened
    if (isOpen && sections.length === 0) {
      fetchSections();
    }
  }, [isOpen, API_URL]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSectionClick = (section: SectionItem) => {
    onSectionSelect(section);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <Button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-main text-mtext border-2 border-border"
      >
        <FolderOpen className="h-4 w-4" />
        <span>Files</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </Button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-white border-2 border-black rounded-lg shadow-lg z-30">
          <div className="py-1">
            {loading && (
              <div className="px-4 py-2 text-sm text-gray-500">Loading...</div>
            )}
            
            {error && (
              <div className="px-4 py-2 text-sm text-red-500">{error}</div>
            )}
            
            {!loading && !error && sections.length === 0 && (
              <div className="px-4 py-2 text-sm text-gray-500">No sections found</div>
            )}

            {sections.map((section) => (
              <button
                key={section.id}
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center"
                onClick={() => handleSectionClick(section)}
              >
                <FolderOpen className="h-4 w-4 mr-2" />
                {section.name}
              </button>
            ))}
            
            <div className="border-t border-gray-200">
              <button
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center text-gray-500"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4 mr-2" />
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileSectionsDropdown;