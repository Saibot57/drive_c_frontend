'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Section } from "@/components/FileList/Section";
import { Search } from "@/components/search";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
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
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4 flex-1">
          <Search onSearch={setSearchTerm} />
          <Button 
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-12 px-4 flex items-center gap-2 border-2 border-black bg-white hover:bg-white"
          >
            <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? '...' : 'Uppdatera'}
          </Button>
        </div>
        <div className="flex items-center ml-4">
          <Checkbox
            id="showTags"
            checked={showTags}
            onCheckedChange={(checked) => setShowTags(checked === true)}
          />
          <Label htmlFor="showTags" className="ml-2">Visa Taggar</Label>
        </div>
      </div>

      <div className="grid gap-8 grid-cols-1 md:grid-cols-2">
                {filteredData?.map((section) => (
          <Section key={section.name} section={section} showTags={showTags} />
        ))}
      </div>
    </div>
  );
}