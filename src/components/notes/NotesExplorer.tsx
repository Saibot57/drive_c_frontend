// src/components/notes/NotesExplorer.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { notesService, NoteFile } from '@/services/notesService';
import { useWindowManager } from '@/contexts/WindowContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ChevronRight, 
  ChevronDown, 
  Folder, 
  FileText, 
  Home, 
  ChevronLeft,
  Plus,
  Search,
  RefreshCw,
  X
} from 'lucide-react';
import NotesWindowWrapper from './NotesWindowWrapper';

interface NotesExplorerProps {
  onClose?: () => void;
}

const NotesExplorer: React.FC<NotesExplorerProps> = ({ onClose }) => {
  // State
  const [currentPath, setCurrentPath] = useState('/');
  const [files, setFiles] = useState<NoteFile[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
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
              setExpandedFolders(prev => ({
                ...prev,
                [selectedFile.id]: true
              }));
            }
          }
          break;
          
        case 'ArrowLeft':
          if (selectedItem) {
            const selectedFile = visibleFiles.find(file => file.id === selectedItem);
            if (selectedFile && selectedFile.is_folder && expandedFolders[selectedFile.id]) {
              e.preventDefault();
              setExpandedFolders(prev => ({
                ...prev,
                [selectedFile.id]: false
              }));
            } else if (currentPath !== '/') {
              e.preventDefault();
              const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/';
              setCurrentPath(parentPath);
            }
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
  }, [files, searchResults, isSearching, selectedItem, expandedFolders, currentPath]);
  
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
  
  // Handler for navigating to a directory
  const navigateToDirectory = (path: string) => {
    setCurrentPath(path);
    setSelectedItem(null);
  };
  
  // Handler for clicking on an item in the file tree
  const handleItemClick = (file: NoteFile) => {
    setSelectedItem(file.id);
    
    if (file.is_folder) {
      if (isSearching) {
        // If searching, navigate to the folder and clear search
        setSearchTerm('');
        setIsSearching(false);
        const folderPath = file.file_path.substring(0, file.file_path.lastIndexOf('/')) || '/';
        navigateToDirectory(folderPath);
      } else {
        // Toggle folder expansion
        setExpandedFolders(prev => ({
          ...prev,
          [file.id]: !prev[file.id]
        }));
      }
    } else {
      // Open the file in a new window
      openNoteInWindow(file);
    }
  };
  
  // Handler for opening a note in a window
  const openNoteInWindow = (file: NoteFile) => {
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
    } catch (error) {
      console.error('Error refreshing files:', error);
      setError('Failed to refresh files. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Render functions
  const renderBreadcrumbs = () => (
    <div className="flex items-center overflow-x-auto whitespace-nowrap pb-2 mb-2 border-b border-gray-200">
      {breadcrumbs.map((crumb, index) => (
        <React.Fragment key={crumb.path}>
          {index > 0 && <ChevronRight className="h-4 w-4 mx-1 text-gray-400" />}
          <button
            className={`px-1 py-0.5 rounded hover:bg-gray-100 ${
              index === breadcrumbs.length - 1 ? 'font-medium text-main' : ''
            }`}
            onClick={() => navigateToDirectory(crumb.path)}
          >
            {index === 0 ? <Home className="h-4 w-4" /> : crumb.name}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
  
  const renderFileTree = (fileList: NoteFile[]) => {
    // Sort files: folders first, then alphabetically
    const sortedFiles = [...fileList].sort((a, b) => {
      if (a.is_folder !== b.is_folder) {
        return a.is_folder ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
    
    return (
      <div className="space-y-1">
        {sortedFiles.map(file => (
          <div 
            key={file.id}
            className={`flex items-center p-1 rounded cursor-pointer ${
              selectedItem === file.id ? 'bg-main text-white' : 'hover:bg-gray-100'
            }`}
            onClick={() => handleItemClick(file)}
          >
            {file.is_folder ? (
              <>
                <button className="mr-1 text-gray-500">
                  {expandedFolders[file.id] ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
                <Folder className={`h-5 w-5 mr-2 ${selectedItem === file.id ? 'text-white' : 'text-blue-500'}`} />
              </>
            ) : (
              <>
                <div className="w-5 mr-1" />
                <FileText className={`h-5 w-5 mr-2 ${selectedItem === file.id ? 'text-white' : 'text-gray-500'}`} />
              </>
            )}
            <span className="truncate">{file.name}</span>
          </div>
        ))}
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
          <div className="mb-2 text-gray-500">
            {loading 
              ? 'Searching...'
              : `Search results for "${searchTerm}" (${searchResults.length} found)`
            }
          </div>
          <Button
            variant="neutral"
            size="sm"
            className="mb-2 h-7 text-xs border border-gray-300"
            onClick={() => {
              setSearchTerm('');
              setIsSearching(false);
            }}
          >
            <X className="h-3 w-3 mr-1" />
            Clear search
          </Button>
        </>
      ) : (
        renderBreadcrumbs()
      )}
      
      {error && (
        <div className="text-red-500 text-sm mb-2">{error}</div>
      )}
      
      <ScrollArea className="flex-1">
        {loading && !isSearching ? (
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-main"></div>
          </div>
        ) : isSearching ? (
          searchResults.length > 0 ? (
            renderFileTree(searchResults)
          ) : (
            <div className="text-gray-500 italic text-center mt-8">
              No matching files found
            </div>
          )
        ) : files.length > 0 ? (
          renderFileTree(files)
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