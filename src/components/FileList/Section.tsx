import React from 'react';
import { ChevronRight, GripVertical } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileCard } from "@/components/FileList/FileCard";
import type { FolderNode } from "@/types/fileSections";

type FolderControls = {
  showTags: boolean;
  isOpen: (folder: FolderNode) => boolean;
  onToggle: (folder: FolderNode) => void;
};

/** Gör fliken till ett grepp som mappen kan dras i, se `useDragSort`. */
export type SectionDrag = {
  handleProps: React.HTMLAttributes<HTMLElement> & { draggable: boolean };
  onKeyDown: (event: React.KeyboardEvent) => void;
};

interface SectionProps extends FolderControls {
  /** Toppmappen. Namnet blir rubrik och innehållet hamnar i rutan. */
  section: FolderNode;
  drag?: SectionDrag;
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

/** Bladet som ligger närmast framsidan är vitt, de bakom i en varmare ton. */
const SHEET_TONES = ['#fbf8ef', '#ffffff'];

/**
 * Bunten mellan mappens baksida och framsida: fler filer ger fler blad,
 * tre filer per blad och högst sex. En tom mapp har inga blad.
 */
export const sheetCount = (fileCount: number) =>
  fileCount === 0 ? 0 : Math.min(6, Math.max(2, Math.round(fileCount / 3)));

const PaperStack: React.FC<{ fileCount: number }> = ({ fileCount }) => (
  <div aria-hidden className="pointer-events-none absolute inset-x-0 top-[7px] h-[58px]">
    {Array.from({ length: sheetCount(fileCount) }, (_, k) => (
      <span
        key={k}
        className="absolute h-full rounded-t-[3px] border-[1.5px] border-b-0 border-black"
        style={{
          top: 1 + k * 4,
          left: 10 + (k % 2 ? 7 : 2) + k,
          right: 10 + ((k * 7) % 5) * 3,
          backgroundColor: SHEET_TONES[k % 2],
          transform: `rotate(${k % 2 ? 0.45 : -0.4}deg)`,
        }}
      />
    ))}
  </div>
);

export const Section: React.FC<SectionProps> = ({ section, drag, ...controls }) => {
  // Generate a consistent color index based on the section name
  const colorIndex = section.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % sectionColors.length;
  const sectionColor = sectionColors[colorIndex];

  return (
    <div className="mb-5 min-w-0">
      {/* Fliken sitter på mappens baksida och har dess färg. Namnet står på en
          vit etikett. Fliken täcker kortets övre kant med -mb-[2px]. Går
          mappen att flytta är fliken greppet; knappen för tangentbordet syns
          bara när pekaren är över fliken eller knappen har fokus. */}
      <h2
        {...drag?.handleProps}
        className={`relative z-10 -mb-[2px] inline-block max-w-[85%] rounded-t-xl border-2 border-b-0 border-black px-[9px] pb-[6px] pt-[7px] align-bottom shadow-[4px_0_0_0_#000] ${
          drag ? 'group/tab cursor-grab select-none active:cursor-grabbing' : ''
        }`}
        style={{ backgroundColor: sectionColor }}
        title={drag ? `${section.name} – dra för att flytta` : section.name}
      >
        <span className="block truncate rounded-[5px] border-2 border-black bg-white px-2.5 pb-0.5 pt-1 font-monument text-[19px] leading-tight">
          {section.name}
        </span>
        {drag && (
          <button
            type="button"
            className="absolute left-full top-1/2 ml-2 -translate-y-1/2 rounded border-2 border-black bg-white p-0.5 opacity-0 transition-opacity focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black group-hover/tab:opacity-100"
            aria-label={`Flytta ${section.name} (piltangenter)`}
            onKeyDown={drag.onKeyDown}
          >
            <GripVertical aria-hidden size={14} />
          </button>
        )}
      </h2>
      {/* Kortet är mappens baksida. Bunten sticker upp ovanför framsidan,
          som är vit och har ett tumgrepp mitt på överkanten. */}
      <div
        className="relative rounded-xl rounded-tl-none border-2 border-black pt-[34px] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
        style={{ backgroundColor: sectionColor }}
      >
        <PaperStack fileCount={section.fileCount} />
        <div className="relative z-[1] rounded-b-[10px] border-t-2 border-black bg-white">
          <span
            aria-hidden
            className="absolute -top-[2px] left-1/2 z-[1] h-5 w-[58px] -translate-x-1/2 rounded-b-full border-2 border-t-0 border-black bg-white"
          />
          <div className="overflow-hidden rounded-b-[10px]">
            {/* Radix lägger innehållet i en display: table, som låter långa namn
                tränga ut till höger i stället för att radbrytas. */}
            <ScrollArea className="h-[350px] [&_[data-radix-scroll-area-viewport]>div]:!block">
              {/* Extra luft till höger: rullningslisten ligger ovanpå innehållet.
                  Luften ovanför håller första raden fri från tumgreppet. */}
              <div className="p-3 pr-5 pt-6">
                <FolderContents folder={section} {...controls} />
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  );
};
