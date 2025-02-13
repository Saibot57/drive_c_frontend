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
  console.log('File has notebooklm:', file.name, file.notebooklm); // Debug log
  
  return (
    <div className="py-0.5 border-0 border-gray-200 last:border-b-0">
      <div className="flex items-center gap-2">
        <a 
          href={file.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-black font-semibold hover:underline block leading-tight"
        >
          {file.name}
        </a>
        {file.notebooklm && (
          <a
            href={file.notebooklm}
            target="_blank"
            rel="noopener noreferrer"
            className="px-1.5 py-0.5 bg-gray-100 text-xs rounded hover:bg-gray-200 cursor-pointer"
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