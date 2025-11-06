// src/components/FileList/FileListWindowWrapper.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Search } from "@/components/search";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { fetchWithAuth } from '@/services/authService';
import type { SectionData } from "@/types/fileSections";
import { FileCard } from "@/components/FileList/FileCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search as SearchIcon, Tags } from "lucide-react";

interface FileListWindowWrapperProps {
  sectionId?: string;
  initialData?: any;
}

const FileListWindowWrapper: React.FC<FileListWindowWrapperProps> = ({ 
  sectionId,
  initialData 
}) => {
  const [data, setData] = useState<SectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTags, setShowTags] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [showSearch, setShowSearch] = useState<boolean>(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://tobiaslundh1.pythonanywhere.com/api';

  // Fetch a specific section if sectionId is provided
  useEffect(() => {
    const fetchSection = async () => {
      if (!sectionId) {
        if (initialData) {
          setData(initialData);
          setLoading(false);
          return;
        }
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        // Fetch the specific section
        const response = await fetchWithAuth(`${API_URL}/files/section/${sectionId}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const json = await response.json();
        setData(json.data);
      } catch (e: any) {
        console.error("Fetch error:", e);
        setError('Failed to load section data.');
      } finally {
        setLoading(false);
      }
    };

    fetchSection();
  }, [sectionId, initialData, API_URL]);

  // Filter files based on search term
  const filteredData = React.useMemo(() => {
    if (!data || !searchTerm.trim()) return data;

    const term = searchTerm.toLowerCase();
    
    // Filter the files in the section
    const filteredFiles = data.files.filter(file => 
      file.name.toLowerCase().includes(term) ||
      (showTags && file.tags?.some(tag => tag.toLowerCase().includes(term)))
    );

    // Filter subsections
    const filteredSubsections = Object.entries(data.subsections || {}).reduce((acc, [key, subsection]) => {
      const filteredSubFiles = subsection.files.filter(file =>
        file.name.toLowerCase().includes(term) ||
        (showTags && file.tags?.some(tag => tag.toLowerCase().includes(term)))
      );

      if (filteredSubFiles.length > 0) {
        acc[key] = {
          ...subsection,
          files: filteredSubFiles
        };
      }

      return acc;
    }, {} as Record<string, any>);

    // Return filtered section
    return {
      ...data,
      files: filteredFiles,
      subsections: filteredSubsections
    };
  }, [data, searchTerm, showTags]);

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">Error: {error}</div>;
  }

  if (!data) {
    return <div className="p-4">No section selected or data available.</div>;
  }

  return (
    <div className="h-full w-full flex flex-col">
      {filteredData && (
        <>
          <div className="flex items-center justify-between mb-2 px-2">
            <h2 className="text-2xl font-monument">{filteredData.name}</h2>
            <div className="flex items-center space-x-2">
              {showSearch ? (
                <div className="relative w-56 mr-2">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search..."
                    className="w-full pl-8 py-1 pr-2 border-2 border-black rounded-lg text-sm"
                  />
                  <SearchIcon className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <button
                    onClick={() => setShowSearch(false)}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowSearch(true)}
                  className="p-1 rounded-lg hover:bg-gray-100"
                  title="Search"
                >
                  <SearchIcon className="h-5 w-5" />
                </button>
              )}
              
              <div className="flex items-center">
                <Tags className="h-4 w-4 mr-1" />
                <div className="h-4 w-4 relative">
                  <input
                    type="checkbox"
                    id="showTagsWindow"
                    checked={showTags}
                    onChange={(e) => setShowTags(e.target.checked)}
                    className="h-4 w-4 border-2 border-black absolute top-0 left-0 z-10 rounded-sm appearance-none checked:bg-black"
                  />
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="white" 
                    strokeWidth="4" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    className={`h-4 w-4 absolute top-0 left-0 z-20 pointer-events-none transition-opacity ${showTags ? 'opacity-100' : 'opacity-0'}`}
                  >
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex-1 overflow-hidden">
            <div className="rounded-2xl border-2 border-black overflow-hidden h-full">
              <ScrollArea className="h-full">
                <div className="p-3">
                  {filteredData.files && filteredData.files.map((file, idx) => (
                    <FileCard key={idx} file={file} showTags={showTags} />
                  ))}
                  {filteredData.subsections && Object.values(filteredData.subsections).map((subsection, idx) => (
                    <div key={idx} className="mt-3">
                      <h3 className="text-xl font-monument mb-1">
                        {subsection.name}
                      </h3>
                      <div className="ml-3">
                        {subsection.files.map((file: any, fileIdx: number) => (
                          <FileCard key={fileIdx} file={file} showTags={showTags} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default FileListWindowWrapper;