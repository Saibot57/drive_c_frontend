'use client';

import React, { useState, useEffect } from 'react';
import { Section } from "@/components/FileList/Section";
import { Search } from "@/components/search";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { SectionData } from "@/types";
import { Red_Hat_Text } from 'next/font/google';

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

  // Add any necessary useEffect or other logic here

  return (
    <div className="space-y-8">
      <h1 className="text-4xl font-bold">Welcome to Your Personal Dashboard</h1>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Drive Catalog Card */}
        <div className="neo-brutalist-card">
          <div className="neo-brutalist-content">
            <h2 className="text-xl font-bold mb-2">Drive Catalog</h2>
            <p className="text-gray-600 mb-4">
              Browse and manage your Google Drive documents with tags and categories.
            </p>
            <a href="/drive" className="text-[#ff6b6b] hover:underline">
              Open Drive Catalog →
            </a>
          </div>
        </div>

        {/* Calendar Card */}
        <div className="neo-brutalist-card">
          <div className="neo-brutalist-content">
            <h2 className="text-xl font-bold mb-2">Calendar</h2>
            <p className="text-gray-600 mb-4">
              Manage your schedule and set reminders for important events.
            </p>
            <a href="/calendar" className="text-[#ff6b6b] hover:underline">
              Open Calendar →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}