// src/components/FileList/FileCard.tsx
import React from 'react';
import { FileData } from '@/types';

interface FileCardProps {
  file: FileData;
  showTags: boolean;
}

export const FileCard: React.FC<FileCardProps> = ({ file, showTags }) => (
  <div className="py-0.5 border-0 border-gray-200 last:border-b-0">
    <a 
      href={file.url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm text-black font-semibold hover:underline block leading-tight"
    >
      {file.name}
    </a>
    {showTags && file.tags && file.tags.length > 0 && (
      <div className="mt-1 flex flex-wrap gap-1">
        {file.tags.map((tag, idx) => (
          <span 
            key={idx} 
            className="px-1.5 py-0.5 bg-gray-100 text-xs rounded hover:bg-gray-200 transition-colors"
          >
            {tag}
          </span>
        ))}
      </div>
    )}
  </div>
);