import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Folder, ChevronRight } from 'lucide-react';
import { notesService, NoteFile } from '@/services/notesService';

interface FolderSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (folderPath: string) => void;
  currentPath: string;
  title: string;
  description?: string;
}

export const FolderSelectModal: React.FC<FolderSelectModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  currentPath,
  title,
  description
}) => {
  const [folders, setFolders] = useState<NoteFile[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>(currentPath);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ name: string; path: string }>>([]);
  
  // Load folders when the modal opens or path changes
  useEffect(() => {
    if (!isOpen) return;
    
    const loadFolders = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const files = await notesService.listFiles(selectedFolder);
        // Filter to only show folders
        const folderList = files.filter(file => file.is_folder);
        setFolders(folderList);
        
        // Update breadcrumbs
        updateBreadcrumbs(selectedFolder);
      } catch (error) {
        console.error('Error loading folders:', error);
        setError('Failed to load folders. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    loadFolders();
  }, [isOpen, selectedFolder]);
  
  // Generate breadcrumbs from a path
  const updateBreadcrumbs = (path: string) => {
    const pathParts = path === '/' 
      ? [{ name: 'Home', path: '/' }] 
      : [
          { name: 'Home', path: '/' },
          ...path.split('/').filter(Boolean).map((segment, index, array) => {
            const segmentPath = '/' + array.slice(0, index + 1).join('/');
            return { name: segment, path: segmentPath };
          })
        ];
    
    setBreadcrumbs(pathParts);
  };
  
  // Navigate to a folder
  const navigateToFolder = (path: string) => {
    setSelectedFolder(path);
  };
  
  // Select a folder and close the modal
  const confirmSelection = () => {
    onSelect(selectedFolder);
    onClose();
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        
        {/* Breadcrumb navigation */}
        <div className="flex items-center flex-wrap gap-1 mb-2 text-sm">
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={crumb.path}>
              {index > 0 && <ChevronRight className="h-4 w-4 text-gray-400" />}
              <button
                className={`px-2 py-0.5 rounded hover:bg-gray-100 ${
                  index === breadcrumbs.length - 1 ? 'font-medium text-main' : ''
                }`}
                onClick={() => navigateToFolder(crumb.path)}
              >
                {crumb.name}
              </button>
            </React.Fragment>
          ))}
        </div>
        
        {/* Folder list */}
        <div className="border rounded-md h-60">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-main"></div>
            </div>
          ) : error ? (
            <div className="p-4 text-red-500">{error}</div>
          ) : folders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <p>No subfolders here</p>
              <p className="text-xs mt-1">You can select the current folder</p>
            </div>
          ) : (
            <ScrollArea className="h-full p-2">
              {folders.map(folder => (
                <div
                  key={folder.id}
                  className={`flex items-center p-2 rounded cursor-pointer hover:bg-gray-100 ${
                    selectedFolder === folder.file_path ? 'bg-gray-100 font-medium' : ''
                  }`}
                  onClick={() => navigateToFolder(folder.file_path)}
                  onDoubleClick={() => navigateToFolder(folder.file_path)}
                >
                  <Folder className="h-5 w-5 mr-2 text-blue-500" />
                  <span>{folder.name}</span>
                </div>
              ))}
            </ScrollArea>
          )}
        </div>
        
        <DialogFooter className="sm:justify-between">
          <div className="flex items-center">
            <Folder className="h-4 w-4 mr-1 text-blue-500" />
            <span className="text-sm text-gray-600 truncate max-w-[180px]">
              {selectedFolder}
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="neutral" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="default" size="sm" onClick={confirmSelection}>
              Select Folder
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};