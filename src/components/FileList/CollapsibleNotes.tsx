'use client';

import React, { useState } from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileCard } from "@/components/FileList/FileCard";
import { SectionData } from "@/app/page";
import { ChevronDown, ChevronUp } from "lucide-react";

interface CollapsibleNotesProps {
  notes: SectionData[];
  showTags: boolean;
}

export const CollapsibleNotes: React.FC<CollapsibleNotesProps> = ({ notes, showTags }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!notes || notes.length === 0) {
    return null;
  }

  return (
    <div className="mt-5">
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full rounded-2xl border-2 border-black bg-[#ff6b6b] text-white py-3 px-4 flex justify-between items-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
      >
        <h2 className="text-2xl font-monument">Anteckningar</h2>
        {isExpanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
      </button>
      
      {isExpanded && (
        <div className="mt-4">
          {/* Render each section */}
          {notes.map((section) => (
            <div key={section.name} className="mb-5">
              <h2 className="text-2xl font-monument mb-2">
                {section.name}
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Main section files */}
                {section.files.length > 0 && (
                  <div className="rounded-2xl border-2 border-black bg-[#ff6b6b] overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <div className="bg-white">
                      <ScrollArea className="max-h-[200px]">
                        <div className="p-3">
                          {section.files.map((file, idx) => (
                            <FileCard key={idx} file={file} showTags={showTags} />
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>
                )}
                
                {/* Render each subsection as a separate box */}
                {Object.values(section.subsections || {}).map((subsection, idx) => (
                  <div key={idx}>
                    <h3 className="text-xl font-monument mb-1">
                      {subsection.name}
                    </h3>
                    <div className="rounded-2xl border-2 border-black bg-[#ff6b6b] overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                      <div className="bg-white">
                        <ScrollArea className="max-h-[200px]">
                          <div className="p-3">
                            {subsection.files.map((file, fileIdx) => (
                              <FileCard key={fileIdx} file={file} showTags={showTags} />
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};