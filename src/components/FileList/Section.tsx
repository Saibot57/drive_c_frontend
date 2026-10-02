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
      {/* Rubriken är en flik som sitter ihop med kortet, så att den står på vitt
          mot sidans bakgrund. Den täcker kortets övre kant med -mb-[2px]. */}
      <h2
        className="relative z-10 -mb-[2px] inline-block max-w-[85%] truncate rounded-t-xl border-2 border-b-0 border-black bg-white px-4 pb-1 pt-2 align-bottom font-monument text-2xl shadow-[4px_0_0_0_#000]"
        title={section.name}
      >
        {section.name}
      </h2>
      <div
        className="rounded-xl rounded-tl-none border-2 border-black overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
        style={{ backgroundColor: sectionColor }}
      >
        <div className="bg-white">
          <ScrollArea className="h-[350px]">
            <div className="p-3">
              {[...section.files]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((file, idx) => (
                  <FileCard key={idx} file={file} showTags={showTags} />
                ))}
              {Object.values(section.subsections || {}).map((subsection, idx) => (
                <div key={idx} className="mt-3">
                  <h3 className="text-xl font-monument mb-1">
                    {subsection.name}
                  </h3>
                  <div className="ml-3">
                    {[...subsection.files]
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((file, fileIdx) => (
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