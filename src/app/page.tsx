'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Section } from "@/components/FileList/Section";
import { FileCard } from "@/components/FileList/FileCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search } from "@/components/search";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { Red_Hat_Text } from 'next/font/google';

const redHat = Red_Hat_Text({ 
  subsets: ['latin'],
  weight: ['400', '500', '700']
});

interface FileData {
  id: string;
  name: string;
  url: string;
  file_path: string;
  tags: string[];
  notebooklm?: string;
  created_time?: string;
}

interface SubSection {
  name: string;
  path: string;
  files: FileData[];
}

export interface SectionData {
  name: string;
  files: FileData[];
  subsections: Record<string, SubSection>;
}

export default function Home() {
  const [data, setData] = useState<{ data: SectionData[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTags, setShowTags] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('https://tobiaslundh1.pythonanywhere.com/api/files');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const json = await response.json();
      setData(json);
    } catch (e: any) {
      console.error("Fetch error:", e);
      setError('Failed to load data.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setError(null);
    
    try {
      // First trigger the backend update
      const updateResponse = await fetch('https://tobiaslundh1.pythonanywhere.com/api/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const updateData = await updateResponse.json();

      if (!updateResponse.ok) {
        throw new Error(updateData.message || 'Failed to update data');
      }

      // Add a small delay to ensure the database has completed its update
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Then fetch the updated data
      await fetchData();
    } catch (err) {
      console.error('Update error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred during update');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredData = useMemo(() => {
    if (!data?.data || !searchTerm.trim()) return data?.data;

    const term = searchTerm.toLowerCase();
    
    return data.data.map(section => {
      const filteredFiles = section.files.filter(file => 
        file.name.toLowerCase().includes(term) ||
        (showTags && file.tags?.some(tag => tag.toLowerCase().includes(term)))
      );

      const filteredSubsections = Object.entries(section.subsections || {}).reduce((acc, [key, subsection]) => {
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
      }, {} as Record<string, SubSection>);

      if (filteredFiles.length > 0 || Object.keys(filteredSubsections).length > 0) {
        return {
          ...section,
          files: filteredFiles,
          subsections: filteredSubsections
        };
      }
      return null;
    }).filter((section): section is SectionData => section !== null);
  }, [data, searchTerm, showTags]);

  // Check if a file is a note (no URL and is a text file)
  const isNote = (file: FileData): boolean => {
    const isNoUrl = !file.url || file.url === null || file.url.trim() === '';
    const isTextFile = (path: string): boolean => {
      const textExtensions = ['.txt', '.md', '.text', ''];
      if (!path.includes('.')) return true;
      const extension = path.substring(path.lastIndexOf('.')).toLowerCase();
      return textExtensions.includes(extension);
    };
    return isNoUrl && isTextFile(file.name);
  };

  // Extract notes from all sections
  const allNotes = useMemo(() => {
    if (!filteredData) return [];
    
    const notes: Array<{ file: FileData; section: string; subsection?: string }> = [];
    
    filteredData.forEach(section => {
      // Notes in main section
      section.files.forEach(file => {
        if (isNote(file)) {
          notes.push({ file, section: section.name });
        }
      });
      
      // Notes in subsections
      Object.entries(section.subsections || {}).forEach(([subName, subsection]) => {
        subsection.files.forEach(file => {
          if (isNote(file)) {
            notes.push({ 
              file, 
              section: section.name, 
              subsection: subName 
            });
          }
        });
      });
    });
    
    return notes;
  }, [filteredData]);

  // Group notes by section
  const groupedNotes = useMemo(() => {
    const groups: Record<string, Array<{ file: FileData; subsection?: string }>> = {};
    
    allNotes.forEach(({ file, section, subsection }) => {
      if (!groups[section]) {
        groups[section] = [];
      }
      
      groups[section].push({ file, subsection });
    });
    
    return groups;
  }, [allNotes]);

  // Collapsible notes section component
  const NotesSection: React.FC<{ 
    groupedNotes: Record<string, Array<{ file: FileData; subsection?: string }>>;
    showTags: boolean;
  }> = ({ groupedNotes, showTags }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    
    if (Object.keys(groupedNotes).length === 0) {
      return null;
    }
    
    return (
      <div className="mt-5">
        <button
          className="w-full text-left p-4 bg-[#ff6b6b] text-white font-monument text-xl rounded-t-xl border-2 border-black flex justify-between items-center"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span>Notes</span>
          <span>{isExpanded ? <ChevronUp className="h-6 w-6" /> : <ChevronDown className="h-6 w-6" />}</span>
        </button>
        
        {isExpanded && (
          <div className="rounded-b-xl border-2 border-t-0 border-black bg-[#ff6b6b] overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <div className="bg-white p-4">
              <ScrollArea className="h-[350px]">
                {Object.entries(groupedNotes).map(([section, notes]) => (
                  <div key={section} className="mb-4">
                    <h3 className="text-xl font-monument mb-2">{section}</h3>
                    <div className="ml-3">
                      {notes.map(({ file, subsection }, idx) => (
                        <div key={idx} className="mb-2">
                          {subsection && <div className="text-sm text-gray-500 mb-1">{subsection}</div>}
                          <FileCard file={file} showTags={showTags} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </ScrollArea>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading && !isRefreshing) {
    return <p>Loading...</p>;
  }

  if (error) {
    return <p>Error: {error}</p>;
  }

  if (!data || !data.data) {
    return <p>No data to display.</p>;
  }

  return (
    <div className="bg-[#fcd7d7]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3 flex-1">
          <Search onSearch={setSearchTerm} />
          <Button 
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-10 px-3 flex items-center gap-2 border-2 border-black bg-white hover:bg-white"
          >
            <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? '...' : 'Uppdatera'}
          </Button>
        </div>
        <div className="flex items-center ml-3">
          <Checkbox
            id="showTags"
            checked={showTags}
            onCheckedChange={(checked) => setShowTags(checked === true)}
          />
          <Label htmlFor="showTags" className="ml-2">Visa Taggar</Label>
        </div>
      </div>

      <div className="grid gap-5 grid-cols-1 md:grid-cols-2">
        {filteredData?.map((section) => (
          <Section key={section.name} section={section} showTags={showTags} />
        ))}
      </div>
      
      {/* Notes section */}
      <NotesSection groupedNotes={groupedNotes} showTags={showTags} />
    </div>
  );
}