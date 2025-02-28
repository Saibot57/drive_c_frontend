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
  const isNote = !file.url || file.url === null || file.url.trim() === '';
  
  const isTextFile = (path: string) => {
    const textExtensions = ['.txt', '.md', '.text', ''];
    if (!path.includes('.')) return true;
    const extension = path.substring(path.lastIndexOf('.')).toLowerCase();
    return textExtensions.includes(extension);
  };
  
  const openInNotes = isNote && isTextFile(file.name);

  const handleOpenNotes = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("Opening note:", file.file_path);
    window.open(`/features/notes?path=${encodeURIComponent(file.file_path)}`, '_blank');
  };

  return (
    <div className="py-0.5 last:border-b-0"> {/* Reduced padding: py-0.5 */}
      <div className="flex items-center gap-2">
        {openInNotes ? (
          <button 
            onClick={handleOpenNotes}
            className="text-sm text-black font-semibold hover:underline block leading-tight text-left cursor-pointer flex-grow"
            style={{ textDecoration: 'underline' }}
          >
            {file.name} {/* Removed (edit) span */}
          </button>
        ) : (
          <a 
            href={file.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-black font-semibold hover:underline block leading-tight flex-grow"
          >
            {file.name}
          </a>
        )}
        {file.notebooklm && (
          <a
            href={file.notebooklm}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#fcd7d7] font-bold hover:underline cursor-pointer ml-1 flex-shrink-0"
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