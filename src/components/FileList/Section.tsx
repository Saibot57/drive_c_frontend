import React from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileCard } from "@/components/FileList/FileCard";
import type { SectionData } from "@/types/fileSections";

interface SectionProps {
  section: SectionData;
  showTags: boolean;
}

// Color palette for rotating section colors
const sectionColors = [
  '#8ecc93', // celadon (green)
  '#dbd3ee', // lavender (purple)
  '#ffd6fe', // mimi pink
  '#ffdccc', // pale dogwood (peachy)
  '#aee8fe', // non photo blue
];

export const Section: React.FC<SectionProps> = ({ section, showTags }) => {
  // Generate a consistent color index based on the section name
  const colorIndex = section.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % sectionColors.length;
  const sectionColor = sectionColors[colorIndex];

  return (
    <div className="mb-5">
      <h2 className="text-2xl font-monument mb-2">
        {section.name}
      </h2>
      <div
        className="rounded-2xl border-2 border-black overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
        style={{ backgroundColor: sectionColor }}
      >
        <div className="bg-white">
          <ScrollArea className="h-[350px]">
            <div className="p-3">
              {section.files.map((file, idx) => (
                <FileCard key={idx} file={file} showTags={showTags} />
              ))}
              {Object.values(section.subsections || {}).map((subsection, idx) => (
                <div key={idx} className="mt-3">
                  <h3 className="text-xl font-monument mb-1">
                    {subsection.name}
                  </h3>
                  <div className="ml-3">
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
  );
};