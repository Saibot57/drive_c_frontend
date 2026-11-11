'use client';

import { Upload } from 'lucide-react';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';

/**
 * "Importera": ett dolt filfält för `.mup` (MindMup) och sidans `.json`.
 * Filen blir alltid en ny karta (useMindmapSync.importFile). Fältet
 * nollställs efter varje val, annars går samma fil inte att välja igen.
 */
export function MindmapImportButton({ onFile, disabled }: { onFile: (file: File) => void; disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button
        size="sm"
        variant="neutral"
        className="sp-btn h-8"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        title="Importera en karta från MindMup (.mup) eller en sparad .json som en ny karta"
      >
        <Upload size={15} /> Importera
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".mup,.json,application/json"
        hidden
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) onFile(file);
        }}
      />
    </>
  );
}
