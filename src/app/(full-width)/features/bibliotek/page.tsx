'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Section } from "@/components/FileList/Section";
import { Search } from "@/components/search";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { RefreshCw, X } from "lucide-react";
import ProtectedRoute from '@/components/ProtectedRoute';
import { fetchWithAuth } from '@/services/authService';
import type { FolderNode, SectionData } from '@/types/fileSections';
import { FeatureNavigation } from '@/components/FeatureNavigation';
import { API_URL } from '@/config/api';
import { usePersistentState } from '@/hooks/usePersistentState';
import {
  LIBRARY_FOLDERS_KEY,
  buildLibraryTree,
  filterLibraryTree,
  isFolderOpen,
  sanitizeFolderOpenState,
  toggleFolder,
} from '@/utils/libraryTree';
import { describeSync, type SyncResult } from '@/utils/librarySync';

const NO_SAVED_FOLDERS = {};

export default function Home() {
  const [data, setData] = useState<{ data: SectionData[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTags, setShowTags] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const dotTimestamps = React.useRef<number[]>([]);
  // Utfällt och hopfällt sparas i webbläsaren. Under en sökning gäller ett
  // eget läge, som släpps när sökordet ändras.
  const [savedFolders, saveFolders] = usePersistentState(
    LIBRARY_FOLDERS_KEY, sanitizeFolderOpenState, NO_SAVED_FOLDERS,
  );
  const [searchToggles, setSearchToggles] = useState<Record<string, boolean>>({});
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

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
      setError('Kunde inte ladda data. Försök uppdatera sidan.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setError(null);
    setSyncResult(null);

    try {
      const updateResponse = await fetchWithAuth(`${API_URL}/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const updateData = await updateResponse.json();

      if (!updateResponse.ok) {
        // API:t lägger felet i `error`, på engelska.
        throw new Error(
          updateData.error ? `Kunde inte uppdatera: ${updateData.error}` : 'Kunde inte uppdatera data.',
        );
      }

      setSyncResult(updateData.data ?? null);
      await fetchData();
    } catch (err) {
      console.error('Update error:', err);
      setError(err instanceof Error ? err.message : 'Något gick fel vid uppdateringen.');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== '.') return;
      const now = Date.now();
      dotTimestamps.current.push(now);
      dotTimestamps.current = dotTimestamps.current.filter(t => now - t < 1000);
      if (dotTimestamps.current.length >= 3) {
        setShowHidden(prev => !prev);
        dotTimestamps.current = [];
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const tree = useMemo(() => buildLibraryTree(data?.data ?? []), [data]);

  const searching = searchTerm.trim() !== '';
  const { folders: visibleSections, searchOpen } = useMemo(
    () => filterLibraryTree(tree, { term: searchTerm, showTags, showHidden }),
    [tree, searchTerm, showTags, showHidden],
  );

  useEffect(() => {
    setSearchToggles({});
  }, [searchTerm]);

  const isOpen = (folder: FolderNode) => (
    searching
      ? searchToggles[folder.path] ?? searchOpen.has(folder.path)
      : isFolderOpen(savedFolders, folder)
  );

  const syncSummary = describeSync(syncResult);

  const toggle = (folder: FolderNode) => {
    if (searching) {
      setSearchToggles(prev => ({ ...prev, [folder.path]: !isOpen(folder) }));
    } else {
      saveFolders(toggleFolder(savedFolders, folder));
    }
  };

  const notice = 'rounded-xl border-2 border-black bg-white px-4 py-3 text-sm shadow-[4px_4px_0px_rgba(0,0,0,1)]';

  return (
    <ProtectedRoute>
      {/* Samma bakgrund som planerarna. Allt som står på den ligger i vita boxar. */}
      <div className="fixed inset-0 z-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/bakgrund59.png" alt="" className="h-full w-full object-cover" />
      </div>
      <div className="relative z-10 space-y-6">
        {/* ── Toolbar ─────────────────────────────────────────────────── */}
        <div className="rounded-xl border-2 border-black bg-white p-4 shadow-[4px_4px_0px_rgba(0,0,0,1)] flex items-center gap-4 flex-wrap">
          <FeatureNavigation />
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
          <label htmlFor="showTags" className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <Checkbox
              id="showTags"
              checked={showTags}
              onCheckedChange={(checked) => setShowTags(checked === true)}
              className="data-[state=checked]:bg-[#8ecc93]"
            />
            Visa taggar
          </label>
        </div>

        {syncSummary && (
          <div className={`${notice} flex items-center justify-between gap-3`} role="status">
            <span
              title={syncResult?.skipped?.map(item => item.path).join('\n') || undefined}
            >
              Uppdaterat från Drive: {syncSummary}
            </span>
            <button
              type="button"
              onClick={() => setSyncResult(null)}
              aria-label="Stäng"
              className="flex-shrink-0 rounded p-0.5 hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ── Content ─────────────────────────────────────────────────── */}
        {loading && !isRefreshing ? (
          <p className={`${notice} text-gray-600`}>Laddar filer…</p>
        ) : error ? (
          <p className={`${notice} text-red-600`}>{error}</p>
        ) : visibleSections.length === 0 ? (
          <p className={`${notice} text-gray-600`}>Inget att visa. Prova att bredda din sökning.</p>
        ) : (
          <div className="grid gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {visibleSections.map((section) => (
              <Section
                key={section.path}
                section={section}
                showTags={showTags}
                isOpen={isOpen}
                onToggle={toggle}
              />
            ))}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
