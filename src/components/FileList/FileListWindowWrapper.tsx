// src/components/FileList/FileListWindowWrapper.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Section } from "@/components/FileList/Section";
import { Search } from "@/components/search";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { fetchWithAuth } from '@/services/authService';
import { SectionData } from "@/app/page";
import { FileCard } from "@/components/FileList/FileCard";
import { ScrollArea } from "@/components/ui/scroll-area";

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
        // Fetch the specific section - you may need to modify your API endpoint to support this
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
      <div className="flex items-center justify-between mb-4 p-2 border-b-2 border-black">
        <div className="flex items-center">
          {showSearch ? (
            <div className="flex-1 mr-2">
              <Search onSearch={setSearchTerm} />
            </div>
          ) : (
            <Button 
              onClick={() => setShowSearch(true)} 
              className="h-9 px-3 border-2 border-black bg-white hover:bg-white"
            >
              Search
            </Button>
          )}
          {showSearch && (
            <Button 
              onClick={() => setShowSearch(false)} 
              className="h-9 px-3 border-2 border-black bg-white hover:bg-white"
            >
              Close
            </Button>
          )}
        </div>
        <div className="flex items-center ml-3">
          <Checkbox
            id="showTagsWindow"
            checked={showTags}
            onCheckedChange={(checked) => setShowTags(checked === true)}
          />
          <Label htmlFor="showTagsWindow" className="ml-2">Show Tags</Label>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {filteredData && (
          <>
            <h2 className="text-2xl font-monument mb-2 px-2">
              {filteredData.name}
            </h2>
            
            <div className="rounded-2xl border-2 border-black bg-[#ff6b6b] overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mx-2">
              <div className="bg-white">
                <ScrollArea className="h-[calc(100%-1rem)]">
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
    </div>
  );
};

export default FileListWindowWrapper;