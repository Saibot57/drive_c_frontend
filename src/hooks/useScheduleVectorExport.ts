'use client';

import { useCallback, useState } from 'react';
import { ScheduleExportInput } from '@/types/scheduleExport';
import { PageMode } from '@/utils/schedulePdf/theme';
import { ExportFormat, exportSchedule } from '@/utils/schedulePdf';

export type VectorExportOutcome = {
  /** `instanceId` för poster vars text klipptes med "…". */
  truncatedInstanceIds: string[];
  /** Texten hamnade under läsbarhetsgränsen. Bara möjligt på papper. */
  isLowScale: boolean;
  filename: string;
};

type Params = {
  /**
   * Byggs av planeraren ur det den redan har. Tar sidläget som argument
   * eftersom scenbredden beror på det.
   */
  buildInput: (pageMode: PageMode) => ScheduleExportInput;
  /**
   * Körs först när filen faktiskt är nedladdad. Till skillnad från
   * utskriftsvägen kan den här exporten inte avbrytas halvvägs, så löftet
   * håller: en misslyckad export rensar ingenting.
   */
  onExportComplete?: (outcome: VectorExportOutcome) => void;
  onExportError?: (error: unknown) => void;
};

export const useScheduleVectorExport = ({
  buildInput,
  onExportComplete,
  onExportError,
}: Params) => {
  const [isExporting, setIsExporting] = useState(false);

  const runExport = useCallback(
    async (format: ExportFormat, pageMode: PageMode) => {
      setIsExporting(true);
      try {
        const outcome = await exportSchedule(buildInput(pageMode), format);
        onExportComplete?.(outcome);
      } catch (error) {
        console.error('Vektorexporten misslyckades.', error);
        onExportError?.(error);
      } finally {
        setIsExporting(false);
      }
    },
    [buildInput, onExportComplete, onExportError]
  );

  return { runExport, isExporting };
};
