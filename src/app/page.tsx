'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Section } from "@/components/FileList/Section";
import { Search } from "@/components/search";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

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

  useEffect(() => {
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

    fetchData();
  }, []);

  const filteredData = useMemo(() => {
    if (!data?.data || !searchTerm.trim()) return data?.data;

    const term = searchTerm.toLowerCase();
    
    return data.data.map(section => {
      // Filter files in the main section
      const filteredFiles = section.files.filter(file => 
        file.name.toLowerCase().includes(term) ||
        (showTags && file.tags?.some(tag => tag.toLowerCase().includes(term)))
      );

      // Filter files in subsections
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

      // Only return sections that have matching files
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

  if (loading) {
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
      <div className="flex items-center justify-between mb-8">
        <Search onSearch={setSearchTerm} />
        <div className="flex items-center">
          <Checkbox
            id="showTags"
            checked={showTags}
            onCheckedChange={(checked) => setShowTags(checked === true)}
          />
          <Label htmlFor="showTags" className="ml-2">Show Tags</Label>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredData?.map((section) => (
          <Section key={section.name} section={section} showTags={showTags} />
        ))}
      </div>
    </div>
  );
}