// src/components/FileList/FileCard.tsx
import React from 'react';

interface FileData {
  id: string;
  name: string;
  url: string;
  file_path: string;
  tags: string[];
  notebooklm?: string;
  created_time?: string;
}

interface FileCardProps {
  file: FileData;
  showTags: boolean;
}

export const FileCard: React.FC<FileCardProps> = ({ file, showTags }) => {
  // Check if the file is likely a note (has no external URL)
  const isNote = !file.url || file.url.trim() === '';
  
  // Function to determine if a path is a text file
  const isTextFile = (path: string) => {
    const textExtensions = ['.txt', '.md', '.text', ''];
    const extension = path.substring(path.lastIndexOf('.')).toLowerCase();
    return textExtensions.includes(extension);
  };
  
  // Only treat it as a note if it's also a text file
  const openInNotes = isNote && isTextFile(file.name);

  const handleOpenNotes = (e: React.MouseEvent) => {
    if (openInNotes) {
      // Explicitly open in a new tab
      window.open(`/features/notes?path=${encodeURIComponent(file.file_path)}`, '_blank');
    }
  };

  return (
    <div className="py-0.5 border-0 border-gray-200 last:border-b-0">
      <div className="flex items-center gap-1">
        {openInNotes ? (
          <button 
            onClick={handleOpenNotes}
            className="text-sm text-black font-semibold hover:underline block leading-tight text-left"
          >
            {file.name} <span className="text-xs text-gray-500">(edit)</span>
          </button>
        ) : (
          <a 
            href={file.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-black font-semibold hover:underline block leading-tight"
          >
            {file.name}
          </a>
        )}
        {file.notebooklm && (
          <a
            href={file.notebooklm}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#fcd7d7] font-bold hover:underline cursor-pointer ml-1"
            title="Open in NotebookLM"
          >
            *
          </a>
        )}
      </div>
      
      {showTags && file.tags && file.tags.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {file.tags.map((tag, idx) => (
            <span key={idx} className="px-1.5 py-0.5 bg-gray-100 text-xs rounded">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};