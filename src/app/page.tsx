'use client';

import React, { useState, useEffect } from 'react';
import { Section } from "@/components/FileList/Section";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label"; // Import Label for checkbox label

// Define interfaces here
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
  const [showTags, setShowTags] = useState<boolean>(false); // Added showTags state

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
    <div className="bg-white dark:bg-secondaryBlack bg-[linear-gradient(to_right,#80808033_1px,transparent_1px),linear-gradient(to_bottom,#80808033_1px,transparent_1px)] bg-[size:70px_70px] font-base">
      <div className="flex items-center justify-end px-4 pt-8"> {/* Padded header area */}
        <div className="flex items-center">
        <Checkbox
      id="showTags"
      checked={showTags}
      onCheckedChange={(checked) => {
        setShowTags(checked === 'checked' || checked === true); // Revised comparison
      }}
    />
          <Label htmlFor="showTags" className="ml-2">Show Tags</Label>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 px-4 py-8"> {/* Responsive grid for sections */}
        {data.data.map((section) => (
          <Section key={section.name} section={section} showTags={showTags} /> // Pass showTags to Section
        ))}
      </div>
    </div>
  );
}