'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Section } from "@/components/FileList/Section";
import { Search } from "@/components/search";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { Red_Hat_Text } from 'next/font/google';
import ProtectedRoute from '@/components/ProtectedRoute';
import { fetchWithAuth } from '@/services/authService';
import type { FileData, SubSection, SectionData } from '@/types/fileSections';

const redHat = Red_Hat_Text({
  subsets: ['latin'],
  weight: ['400', '500', '700']
});

export default function Home() {
  const [data, setData] = useState<{ data: SectionData[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTags, setShowTags] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://tobiaslundh1.pythonanywhere.com/api';

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchWithAuth(`${API_URL}/files`);
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
      const updateResponse = await fetchWithAuth(`${API_URL}/update`, {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredData = useMemo(() => {
    if (!data?.data) return [];

    const term = searchTerm.toLowerCase().trim();

    return data.data.map(section => {
      // Only keep files that have a valid URL
      const filteredFiles = section.files.filter(file =>
        file.url && file.url.trim() !== '' &&
        (!term ||
          file.name.toLowerCase().includes(term) ||
          (showTags && file.tags?.some(tag => tag.toLowerCase().includes(term))))
      );

      const filteredSubsections = Object.entries(section.subsections || {}).reduce((acc, [key, subsection]) => {
        const filteredSubFiles = subsection.files.filter(file =>
          file.url && file.url.trim() !== '' &&
          (!term ||
            file.name.toLowerCase().includes(term) ||
            (showTags && file.tags?.some(tag => tag.toLowerCase().includes(term))))
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

  return (
    <ProtectedRoute>
      <div className="bg-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 flex-1">
            <Search onSearch={setSearchTerm} />
            <Button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-10 px-3 flex items-center gap-2 border-2 border-black bg-[#aee8fe] hover:bg-[#59cffd] transition-colors"
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
              className="border-2 border-black data-[state=checked]:bg-[#8ecc93] data-[state=checked]:border-black"
            />
            <Label htmlFor="showTags" className="ml-2">Visa Taggar</Label>
          </div>
        </div>

        {loading && !isRefreshing ? (
          <p>Loading...</p>
        ) : error ? (
          <p>Error: {error}</p>
        ) : filteredData.length === 0 ? (
          <p>No data to display.</p>
        ) : (
          <div className="grid gap-5 grid-cols-1 md:grid-cols-3">
            {filteredData.map((section) => (
              <Section key={section.name} section={section} showTags={showTags} />
            ))}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
