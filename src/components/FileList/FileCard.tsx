import React from 'react';
import type { FileData } from '@/types/fileSections';

interface FileCardProps {
  file: FileData;
  showTags: boolean;
}

export const FileCard: React.FC<FileCardProps> = ({ file, showTags }) => {
  return (
    <div className="py-0.5 last:border-b-0">
      <div className="flex items-center gap-2">
        <a
          href={file.url}
          target="_blank"
          rel="noopener noreferrer"
          className="min-w-0 break-words text-sm text-black font-semibold hover:underline block leading-tight flex-grow"
        >
          {file.name}
        </a>
        {file.notebooklm && (
          <a
            href={file.notebooklm}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 flex-shrink-0 rounded border border-black bg-[#fcd7d7] px-1 text-2xs font-bold text-black transition-colors hover:bg-[#f9b4b4]"
            title="Öppna i NotebookLM"
          >
            NB
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
