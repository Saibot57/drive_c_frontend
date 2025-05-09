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
    <h2 className="text-3xl font-monument mb-4">
      {section.name}
    </h2>
    <div className="rounded-2xl border-2 border-black bg-[#ff6b6b] overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      <div className="bg-white">
        <ScrollArea className="h-[400px]">
          <div className="p-4">
            {section.files.map((file, idx) => (
              <FileCard key={idx} file={file} showTags={showTags} />
            ))}
            {Object.values(section.subsections || {}).map((subsection, idx) => (
              <div key={idx} className="mt-4">
                <h3 className="text-2xl font-monument mb-2">
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
  </div>
);