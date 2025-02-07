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

const FileCard: React.FC<FileCardProps> = ({ file, showTags }) => (
  <div className="py-2 border-b border-border dark:border-darkBorder last:border-b-0"> {/* Simple list item container */}
    <a href={file.url}
       target="_blank"
       rel="noopener noreferrer"
       className="text-text dark:text-darkText hover:underline font-medium block truncate"> {/* File name link - block and truncate classes */}
      {file.name}
    </a>
    {showTags && file.tags && file.tags.length > 0 && (
      <div className="mt-1 flex flex-wrap gap-2 text-sm"> {/* Tags - reduced margin and smaller text */}
        {file.tags.map((tag, idx) => (
          <span key={idx} className="px-2 py-0.5 border border-border dark:border-darkBorder rounded-base text-xs bg-gray-100 dark:bg-gray-800"> {/* Tag spans - simplified styling */}
            {tag}
          </span>
        ))}
      </div>
    )}
  </div>
);

export { FileCard };