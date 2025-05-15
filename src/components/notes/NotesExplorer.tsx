// src/components/notes/NotesExplorer.tsx
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { notesService, NoteFile } from '@/services/notesService';
import { useWindowManager } from '@/contexts/WindowContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { 
  ChevronRight, 
  Folder, 
  FileText, 
  Home, 
  ChevronLeft,
  Plus,
  Search,
  RefreshCw,
  X,
  FolderOpen
} from 'lucide-react';
import NotesWindowWrapper from './NotesWindowWrapper';

interface NotesExplorerProps {
  onClose?: () => void;
}

const NotesExplorer: React.FC<NotesExplorerProps> = ({ onClose }) => {
  // State
  const [currentPath, setCurrentPath] = useState('/');
  const [files, setFiles] = useState<NoteFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<NoteFile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFileName, setNewFileName] = useState('');
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [showNewFileInput, setShowNewFileInput] = useState(false);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [folderStats, setFolderStats] = useState<Record<string, {fileCount: number; folderCount: number}>>({});
  
  // Refs
  const newFolderInputRef = useRef<HTMLInputElement>(null);
  const newFileInputRef = useRef<HTMLInputElement>(null);
  const explorerRef = useRef<HTMLDivElement>(null);
  
  // Context
  const { openWindow } = useWindowManager();
  
  // Generate breadcrumbs
  const breadcrumbs = currentPath === '/' 
    ? [{ name: 'Home', path: '/' }] 
    : [
        { name: 'Home', path: '/' },
        ...currentPath.split('/').filter(Boolean).map((segment, index, array) => {
          const path = '/' + array.slice(0, index + 1).join('/');
          return { name: segment, path };
        })
      ];
  
  // Load files in current path
  useEffect(() => {
    const loadFiles = async () => {
      if (isSearching) return; // Don't load files when searching
      
      setLoading(true);
      setError(null);
      
      try {
        const result = await notesService.listFiles(currentPath);
        setFiles(result);
        
        // Collect stats for each folder in this directory
        const stats: Record<string, {fileCount: number; folderCount: number}> = {};
        
        // Process each folder to get stats
        for (const file of result) {
          if (file.is_folder) {
            try {
              // Get the contents of this folder to count files and subfolders
              const folderPath = file.file_path;
              const folderContents = await notesService.listFiles(folderPath);
              
              const fileCount = folderContents.filter(f => !f.is_folder).length;
              const folderCount = folderContents.filter(f => f.is_folder).length;
              
              stats[file.id] = { fileCount, folderCount };
            } catch (error) {
              console.error(`Error getting stats for folder ${file.file_path}:`, error);
              stats[file.id] = { fileCount: 0, folderCount: 0 };
            }
          }
        }
        
        setFolderStats(stats);
      } catch (error) {
        console.error('Error loading files:', error);
        setError('Failed to load files. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    loadFiles();
  }, [currentPath, isSearching]);
  
  // Focus new input fields when they appear
  useEffect(() => {
    if (showNewFolderInput && newFolderInputRef.current) {
      newFolderInputRef.current.focus();
    }
    
    if (showNewFileInput && newFileInputRef.current) {
      newFileInputRef.current.focus();
    }
  }, [showNewFolderInput, showNewFileInput]);
  
  // Handler for navigating to a directory (use useCallback to prevent dependency issues)
  const navigateToDirectory = useCallback((path: string) => {
    setCurrentPath(path);
    setSelectedItem(null);
  }, []);

  // Handler for opening a note in a window (use useCallback to prevent dependency issues)
  const openNoteInWindow = useCallback((file: NoteFile) => {
    // Get path and filename
    const filePath = file.file_path;
    const lastSlashIndex = filePath.lastIndexOf('/');
    
    const path = lastSlashIndex > 0 ? filePath.substring(0, lastSlashIndex) : '/';
    const filename = lastSlashIndex >= 0 ? filePath.substring(lastSlashIndex + 1) : filePath;
    
    // Open the window
    openWindow(
      `note-${file.id}`, 
      <NotesWindowWrapper filename={filename} path={path} />, 
      filename,
      {
        dimensions: { width: 800, height: 600 },
        position: { x: 100, y: 100 }
      }
    );
    
    // Close the explorer if onClose is provided
    if (onClose) {
      onClose();
    }
  }, [openWindow, onClose]);
  
  // Handler for clicking on an item in the file tree (use useCallback to prevent dependency issues)
  const handleItemClick = useCallback((file: NoteFile) => {
    setSelectedItem(file.id);
    
    if (file.is_folder) {
      // Navigate to this folder - clean up search if active
      if (isSearching) {
        setSearchTerm('');
        setIsSearching(false);
      }
      
      // Navigate to the folder path
      navigateToDirectory(file.file_path);
    } else {
      // Open the file in a new window
      openNoteInWindow(file);
    }
  }, [isSearching, navigateToDirectory, openNoteInWindow]);
  
  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!explorerRef.current || document.activeElement instanceof HTMLInputElement) {
        return;
      }
      
      const visibleFiles = isSearching ? searchResults : files;
      
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedItem(prev => {
            if (!prev) return visibleFiles[0]?.id;
            const currentIndex = visibleFiles.findIndex(file => file.id === prev);
            if (currentIndex === -1 || currentIndex === visibleFiles.length - 1) return prev;
            return visibleFiles[currentIndex + 1].id;
          });
          break;
          
        case 'ArrowUp':
          e.preventDefault();
          setSelectedItem(prev => {
            if (!prev) return visibleFiles[visibleFiles.length - 1]?.id;
            const currentIndex = visibleFiles.findIndex(file => file.id === prev);
            if (currentIndex <= 0) return prev;
            return visibleFiles[currentIndex - 1].id;
          });
          break;
          
        case 'ArrowRight':
          if (selectedItem) {
            const selectedFile = visibleFiles.find(file => file.id === selectedItem);
            if (selectedFile && selectedFile.is_folder) {
              e.preventDefault();
              // Navigate into the folder
              navigateToDirectory(selectedFile.file_path);
            }
          }
          break;
          
        case 'ArrowLeft':
          if (currentPath !== '/') {
            e.preventDefault();
            const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/';
            navigateToDirectory(parentPath);
          }
          break;
          
        case 'Enter':
          if (selectedItem) {
            e.preventDefault();
            const selectedFile = visibleFiles.find(file => file.id === selectedItem);
            if (selectedFile) {
              handleItemClick(selectedFile);
            }
          }
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [files, searchResults, isSearching, selectedItem, currentPath, navigateToDirectory, handleItemClick]);
  
  // Handle search
  useEffect(() => {
    const performSearch = async () => {
      if (!searchTerm.trim()) {
        setIsSearching(false);
        setSearchResults([]);
        return;
      }
      
      setIsSearching(true);
      setLoading(true);
      
      try {
        // For now, we'll do a simple search by listing all files recursively
        // In a real app, you'd want a proper search API endpoint
        const allFiles = await searchFiles(searchTerm);
        setSearchResults(allFiles);
      } catch (error) {
        console.error('Error searching files:', error);
      } finally {
        setLoading(false);
      }
    };
    
    const debounceTimeout = setTimeout(performSearch, 300);
    return () => clearTimeout(debounceTimeout);
  }, [searchTerm]);
  
  // Helper to recursively search files
  const searchFiles = async (term: string): Promise<NoteFile[]> => {
    const searchInDirectory = async (path: string): Promise<NoteFile[]> => {
      try {
        const dirFiles = await notesService.listFiles(path);
        
        // Filter files that match the search term in current directory
        const matchingFiles = dirFiles.filter(file => 
          file.name.toLowerCase().includes(term.toLowerCase())
        );
        
        // Recursively search in subdirectories
        const subDirResults = await Promise.all(
          dirFiles
            .filter(file => file.is_folder)
            .map(async (folder) => {
              const folderPath = path === '/' ? `/${folder.name}` : `${path}/${folder.name}`;
              return searchInDirectory(folderPath);
            })
        );
        
        // Combine all results
        return [
          ...matchingFiles,
          ...subDirResults.flat()
        ];
      } catch (error) {
        console.error(`Error searching in ${path}:`, error);
        return [];
      }
    };
    
    return searchInDirectory('/');
  };
  
  // Handler for creating a new folder
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      setShowNewFolderInput(false);
      return;
    }
    
    setLoading(true);
    
    try {
      const folderPath = currentPath === '/' 
        ? `/${newFolderName}` 
        : `${currentPath}/${newFolderName}`;
      
      await notesService.createDirectory(folderPath);
      
      // Refresh file list
      const result = await notesService.listFiles(currentPath);
      setFiles(result);
      
      // Reset state
      setNewFolderName('');
      setShowNewFolderInput(false);
    } catch (error) {
      console.error('Error creating folder:', error);
      setError('Failed to create folder. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Handler for creating a new file
  const handleCreateFile = () => {
    if (!newFileName.trim()) {
      setShowNewFileInput(false);
      return;
    }
    
    // Ensure filename has .md extension
    let filename = newFileName;
    if (!filename.endsWith('.md')) {
      filename += '.md';
    }
    
    // Open an empty note in a window
    openWindow(
      `note-new-${Date.now()}`, 
      <NotesWindowWrapper filename={filename} path={currentPath} />, 
      filename,
      {
        dimensions: { width: 800, height: 600 },
        position: { x: 100, y: 100 }
      }
    );
    
    // Reset state
    setNewFileName('');
    setShowNewFileInput(false);
    
    // Close the explorer if onClose is provided
    if (onClose) {
      onClose();
    }
  };
  
  // Handler for refreshing the file list
  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await notesService.listFiles(currentPath);
      setFiles(result);
      
      // Refresh folder stats too
      const stats: Record<string, {fileCount: number; folderCount: number}> = {};
      
      for (const file of result) {
        if (file.is_folder) {
          try {
            const folderPath = file.file_path;
            const folderContents = await notesService.listFiles(folderPath);
            
            const fileCount = folderContents.filter(f => !f.is_folder).length;
            const folderCount = folderContents.filter(f => f.is_folder).length;
            
            stats[file.id] = { fileCount, folderCount };
          } catch (error) {
            console.error(`Error getting stats for folder ${file.file_path}:`, error);
            stats[file.id] = { fileCount: 0, folderCount: 0 };
          }
        }
      }
      
      setFolderStats(stats);
    } catch (error) {
      console.error('Error refreshing files:', error);
      setError('Failed to refresh files. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Handler for going up one level
  const handleNavigateUp = () => {
    if (currentPath === '/') return;
    
    const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/';
    navigateToDirectory(parentPath);
  };
  
  // Render functions
  const renderBreadcrumbs = () => (
    <div className="pb-2 mb-2 border-b border-gray-200">
      <div className="flex items-center mb-1">
        {currentPath !== '/' && (
          <Button
            variant="neutral"
            size="sm"
            className="h-7 w-7 p-0 mr-2 border border-gray-200"
            onClick={handleNavigateUp}
            title="Go up one level"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
        
        <Breadcrumb className="flex-1">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink 
                onClick={() => navigateToDirectory('/')}
                className={`p-1 rounded-md flex items-center ${currentPath === '/' ? 'bg-main text-white' : 'hover:bg-gray-100'}`}
              >
                <Home className="h-4 w-4" />
              </BreadcrumbLink>
            </BreadcrumbItem>
            
            {currentPath !== '/' && currentPath.split('/').filter(Boolean).map((segment, index, array) => {
              const path = '/' + array.slice(0, index + 1).join('/');
              const isLast = index === array.length - 1;
              
              return (
                <React.Fragment key={path}>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    {isLast ? (
                      <BreadcrumbPage 
                        className={`px-2 py-1 rounded-md bg-gray-100 text-main font-medium`}
                      >
                        {segment}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink
                        onClick={() => navigateToDirectory(path)}
                        className="px-2 py-1 rounded-md hover:bg-gray-100"
                      >
                        {segment}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </React.Fragment>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      
      <div className="pl-2 text-xs text-gray-500">{currentPath}</div>
    </div>
  );
  
  const renderFileList = (fileList: NoteFile[]) => {
    // Sort files: folders first, then alphabetically
    const sortedFiles = [...fileList].sort((a, b) => {
      if (a.is_folder !== b.is_folder) {
        return a.is_folder ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
    
    return (
      <div className="space-y-1">
        {sortedFiles.map(file => {
          const folderInfo = file.is_folder ? folderStats[file.id] : null;
          const isEmpty = folderInfo && folderInfo.fileCount === 0 && folderInfo.folderCount === 0;
          
          return (
            <div 
              key={file.id}
              className={`flex items-center p-2 rounded-md cursor-pointer ${
                selectedItem === file.id ? 'bg-main text-white' : 'hover:bg-gray-100'
              }`}
              onClick={() => handleItemClick(file)}
            >
              {file.is_folder ? (
                <>
                  {isEmpty ? (
                    <Folder className={`h-5 w-5 mr-2 ${selectedItem === file.id ? 'text-white' : 'text-blue-500'}`} />
                  ) : (
                    <FolderOpen className={`h-5 w-5 mr-2 ${selectedItem === file.id ? 'text-white' : 'text-blue-500'}`} />
                  )}
                  <span className="truncate flex-1">{file.name}</span>
                  {folderInfo && (
                    <div className="flex items-center gap-1 ml-2">
                      {folderInfo.fileCount > 0 && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                          selectedItem === file.id ? 'bg-white/20' : 'bg-blue-100'
                        }`} title="Files">
                          {folderInfo.fileCount} <FileText className="h-3 w-3 inline" />
                        </span>
                      )}
                      
                      {folderInfo.folderCount > 0 && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                          selectedItem === file.id ? 'bg-white/20' : 'bg-blue-100'
                        }`} title="Folders">
                          {folderInfo.folderCount} <Folder className="h-3 w-3 inline" />
                        </span>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <FileText className={`h-5 w-5 mr-2 ${selectedItem === file.id ? 'text-white' : 'text-gray-500'}`} />
                  <span className="truncate">{file.name}</span>
                </>
              )}
            </div>
          );
        })}
      </div>
    );
  };
  
  return (
    <div className="flex flex-col h-full p-4" ref={explorerRef}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-monument">Notes Explorer</h2>
        {onClose && (
          <Button 
            onClick={onClose}
            variant="neutral" 
            size="sm"
            className="h-8 w-8 p-0 border-2 border-black"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      
      <div className="mb-4">
        <div className="relative">
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search notes..."
            className="pl-10 border-2 border-black"
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          {searchTerm && (
            <button
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              onClick={() => setSearchTerm('')}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      
      <div className="flex justify-between mb-2">
        <div className="flex gap-2">
          <Button
            variant="neutral"
            size="sm"
            className="h-8 border-2 border-black bg-white"
            onClick={() => setShowNewFileInput(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            New Note
          </Button>
          <Button
            variant="neutral"
            size="sm"
            className="h-8 border-2 border-black bg-white"
            onClick={() => setShowNewFolderInput(true)}
          >
            <Folder className="h-4 w-4 mr-1" />
            New Folder
          </Button>
        </div>
        <Button
          variant="neutral"
          size="sm"
          className="h-8 w-8 p-0 border-2 border-black bg-white"
          onClick={handleRefresh}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>
      
      {showNewFolderInput && (
        <div className="mb-4 flex items-center">
          <Input
            ref={newFolderInputRef}
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Folder name"
            className="flex-1 mr-2 border-2 border-black"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCreateFolder();
              } else if (e.key === 'Escape') {
                setShowNewFolderInput(false);
                setNewFolderName('');
              }
            }}
          />
          <Button
            variant="default"
            size="sm"
            className="h-8 border-2 border-black"
            onClick={handleCreateFolder}
          >
            Create
          </Button>
        </div>
      )}
      
      {showNewFileInput && (
        <div className="mb-4 flex items-center">
          <Input
            ref={newFileInputRef}
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            placeholder="File name"
            className="flex-1 mr-2 border-2 border-black"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCreateFile();
              } else if (e.key === 'Escape') {
                setShowNewFileInput(false);
                setNewFileName('');
              }
            }}
          />
          <Button
            variant="default"
            size="sm"
            className="h-8 border-2 border-black"
            onClick={handleCreateFile}
          >
            Create
          </Button>
        </div>
      )}
      
      {isSearching && searchTerm ? (
        <>
          <div className="pb-2 mb-2 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <Button
                variant="neutral"
                size="sm"
                className="h-7 text-xs border border-gray-300"
                onClick={() => {
                  setSearchTerm('');
                  setIsSearching(false);
                }}
              >
                <X className="h-3 w-3 mr-1" />
                Clear search
              </Button>
              
              <span className="text-gray-600">
                {loading 
                  ? 'Searching...'
                  : `Search results for "${searchTerm}" (${searchResults.length} found)`
                }
              </span>
            </div>
            
            <div className="pl-2 mt-1 text-xs text-gray-500">
              Search results from all directories
            </div>
          </div>
        </>
      ) : (
        renderBreadcrumbs()
      )}
      
      {error && (
        <div className="text-red-500 text-sm mb-2 p-2 bg-red-50 rounded border border-red-200">
          {error}
        </div>
      )}
      
      <ScrollArea className="flex-1">
        {loading && !isSearching ? (
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-main"></div>
          </div>
        ) : isSearching ? (
          searchResults.length > 0 ? (
            renderFileList(searchResults)
          ) : (
            <div className="text-gray-500 italic text-center mt-8">
              No matching files found
            </div>
          )
        ) : files.length > 0 ? (
          renderFileList(files)
        ) : (
          <div className="text-gray-500 italic text-center mt-8">
            This directory is empty
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default NotesExplorer;