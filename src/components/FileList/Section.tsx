import React from 'react';
import { ChevronRight } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileCard } from "@/components/FileList/FileCard";
import type { FolderNode } from "@/types/fileSections";

type FolderControls = {
  showTags: boolean;
  isOpen: (folder: FolderNode) => boolean;
  onToggle: (folder: FolderNode) => void;
};

interface SectionProps extends FolderControls {
  /** Toppmappen. Namnet blir rubrik och innehållet hamnar i rutan. */
  section: FolderNode;
}

// Color palette for rotating section colors
const sectionColors = [
  '#8ecc93', // celadon (green)
  '#dbd3ee', // lavender (purple)
  '#ffd6fe', // mimi pink
  '#ffdccc', // pale dogwood (peachy)
  '#aee8fe', // non photo blue
];

/** Undermapparna först, som i Drive, sedan filerna. */
const FolderContents: React.FC<FolderControls & { folder: FolderNode }> = ({ folder, ...controls }) => (
  <>
    {folder.folders.map(child => (
      <Folder key={child.path} folder={child} {...controls} />
    ))}
    {folder.files.length > 0 && (
      <div className={folder.folders.length > 0 ? 'mt-2' : undefined}>
        {folder.files.map(file => (
          <FileCard key={file.id} file={file} showTags={controls.showTags} />
        ))}
      </div>
    )}
  </>
);

/**
 * En mapp som går att fälla ut och ihop. Nivå 2 ser ut som underrubrikerna
 * gjorde förut; djupare mappar är rader med antalet filer när de är hopfällda.
 */
const Folder: React.FC<FolderControls & { folder: FolderNode }> = ({ folder, ...controls }) => {
  const open = controls.isOpen(folder);
  const subheading = folder.level <= 2;

  return (
    <div className={subheading ? 'mt-3 first:mt-0' : 'mt-1'}>
      <button
        type="button"
        onClick={() => controls.onToggle(folder)}
        aria-expanded={open}
        className="group flex w-full items-start gap-1 text-left"
      >
        <ChevronRight
          aria-hidden
          className={`flex-shrink-0 transition-transform ${open ? 'rotate-90' : ''} ${
            subheading ? 'mt-[3px] h-4 w-4' : 'mt-[1px] h-3.5 w-3.5'
          }`}
        />
        <span
          className={`min-w-0 flex-grow break-words leading-tight group-hover:underline ${
            subheading ? 'font-monument text-lg' : 'text-sm font-semibold'
          }`}
        >
          {folder.name}
        </span>
        {!open && (
          <span className="flex-shrink-0 pl-1 text-xs tabular-nums text-gray-500">
            {folder.fileCount}
          </span>
        )}
      </button>
      {open && (
        <div className="ml-[7px] mt-0.5 border-l border-black/15 pl-2">
          <FolderContents folder={folder} {...controls} />
        </div>
      )}
    </div>
  );
};

export const Section: React.FC<SectionProps> = ({ section, ...controls }) => {
  // Generate a consistent color index based on the section name
  const colorIndex = section.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % sectionColors.length;
  const sectionColor = sectionColors[colorIndex];

  return (
    <div className="mb-5 min-w-0">
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
          {/* Radix lägger innehållet i en display: table, som låter långa namn
              tränga ut till höger i stället för att radbrytas. */}
          <ScrollArea className="h-[350px] [&_[data-radix-scroll-area-viewport]>div]:!block">
            {/* Extra luft till höger: rullningslisten ligger ovanpå innehållet. */}
            <div className="p-3 pr-5">
              <FolderContents folder={section} {...controls} />
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
};
