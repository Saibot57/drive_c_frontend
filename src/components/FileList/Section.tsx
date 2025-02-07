// src/components/FileList/Section.tsx
import React from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileCard } from "@/components/FileList/FileCard";
import { SectionData } from "@/app/page";

interface SectionProps {
  section: SectionData;
  showTags: boolean; // Receive showTags prop
}

const Section: React.FC<SectionProps> = ({ section, showTags }) => ( // Receive showTags prop
  <div className="mb-8">
    <h2 className="text-xl font-bold mb-4 border-b-2 border-border dark:border-darkBorder pb-2">
      {section.name}
    </h2>
    <ScrollArea className="h-64 rounded-xl border-2 border-border dark:border-darkBorder p-4 bg-white dark:bg-secondaryBlack"> {/* Reduced ScrollArea height to h-64 */}
      <div className="space-y-2"> {/* Reduced space between FileCard items */}
        {section.files.map((file, idx) => (
          <FileCard key={idx} file={file} showTags={showTags} /> // Pass showTags prop to FileCard
        ))}
        {Object.values(section.subsections || {}).map((subsection, idx) => (
          <div key={idx} className="mt-4">
            <h3 className="text-lg font-semibold mb-3 border-b border-border dark:border-darkBorder pb-1">{subsection.name}</h3>
            <div className="space-y-2 ml-4"> {/* Reduced space and indented subsection files */}
              {subsection.files.map((file, fileIdx) => (
                <FileCard key={fileIdx} file={file} showTags={showTags} /> // Pass showTags prop to FileCard
              ))}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  </div>
);

export { Section };