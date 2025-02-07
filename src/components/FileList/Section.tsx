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
    <h2 className="text-xl font-bold mb-4 pb-2">
      {section.name}
    </h2>
    <div className="rounded-xl border-4 border-black bg-[#ff6b6b] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
      <div className="bg-white w-full h-full">
        <ScrollArea className="h-64 px-4 py-2">
          <div className="space-y-2">
            {section.files.map((file, idx) => (
              <FileCard key={idx} file={file} showTags={showTags} />
            ))}
            {Object.values(section.subsections || {}).map((subsection, idx) => (
              <div key={idx} className="mt-4">
                <h3 className="text-lg font-semibold mb-3 pb-1">
                  {subsection.name}
                </h3>
                <div className="space-y-2 ml-4">
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
  </div>
)