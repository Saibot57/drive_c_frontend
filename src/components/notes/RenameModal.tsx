import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FileText, Folder } from 'lucide-react';

interface RenameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRename: (newName: string) => void;
  currentName: string;
  isFolder: boolean;
}

export const RenameModal: React.FC<RenameModalProps> = ({
  isOpen,
  onClose,
  onRename,
  currentName,
  isFolder
}) => {
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Set initial name when the modal opens
  useEffect(() => {
    if (isOpen) {
      setName(currentName);
      setError(null);
      
      // Focus the input after a small delay to ensure it's ready
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          
          // Select the name part without the extension for files
          if (!isFolder && currentName.includes('.')) {
            const lastDotIndex = currentName.lastIndexOf('.');
            inputRef.current.setSelectionRange(0, lastDotIndex);
          } else {
            inputRef.current.select();
          }
        }
      }, 50);
    }
  }, [isOpen, currentName, isFolder]);
  
  const handleRename = () => {
    // Validate the new name
    if (!name.trim()) {
      setError('Name cannot be empty');
      return;
    }
    
    // For files, preserve the file extension if it had one
    let newName = name;
    if (!isFolder && currentName.includes('.') && !name.includes('.')) {
      const extension = currentName.substring(currentName.lastIndexOf('.'));
      newName = name + extension;
    }
    
    onRename(newName);
    onClose();
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isFolder ? <Folder className="h-5 w-5 text-blue-500" /> : <FileText className="h-5 w-5 text-gray-500" />}
            Rename {isFolder ? 'Folder' : 'File'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-2">
          <Input
            ref={inputRef}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            className="border-2 border-black"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleRename();
              }
            }}
          />
          {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
        </div>
        
        <DialogFooter className="sm:justify-end">
          <Button variant="neutral" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="default" size="sm" onClick={handleRename}>
            Rename
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};