// src/components/FileList/Section.tsx
import React from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileCard } from "@/components/FileList/FileCard";
import { SectionData } from "@/app/page";

interface SectionProps {
  section: SectionData;
  showTags: boolean;
}

export const Section: React.FC<SectionProps> = ({ section, showTags }) => (
  <div className="mb-8">
    <h2 className="text-xl font-bold mb-4">
      {section.name}
    </h2>
    <div className="border-[3px] border-black rounded-2xl bg-white overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      <ScrollArea className="h-[300px]">
        <div className="p-4">
          {section.files.map((file, idx) => (
            <FileCard key={idx} file={file} showTags={showTags} />
          ))}
          {Object.values(section.subsections || {}).map((subsection, idx) => (
            <div key={idx} className="mt-4">
              <h3 className="text-lg font-semibold mb-2">
                {subsection.name}
              </h3>
              <div className="ml-4">
                {subsection.files.map((file, fileIdx) => (
                  <FileCard key={fileIdx} file={file} showTags={showTags} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  </div>
);