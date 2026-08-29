/**
 * Exportens ytterdörr.
 *
 * Bygger scenen ur schemadatan, renderar den till valt format och laddar ner
 * filen. Ingen systemutskriftsdialog inblandad — filen skapas i kod, vilket
 * också är varför `truncated` går att rapportera ärligt: kommer vi hit har
 * filen faktiskt blivit till.
 */

import { ScheduleExportInput } from '@/types/scheduleExport';
import { buildScene } from './buildScene';
import { createJsPdfMeasurer } from './jspdfMeasurer';
import { sceneToPdf } from './sceneToPdf';
import { sceneToRaster } from './sceneToPng';
import { sceneToSvg } from './sceneToSvg';

export type ExportFormat = 'pdf' | 'png' | 'jpeg' | 'svg';

export type ExportOutcome = {
  /** `instanceId` för poster vars text inte rymdes och slutar med "…". */
  truncatedInstanceIds: string[];
  /** Texten hamnade under läsbarhetsgränsen. Bara möjligt på papper. */
  isLowScale: boolean;
  filename: string;
};

const EXTENSION: Record<ExportFormat, string> = {
  pdf: 'pdf',
  png: 'png',
  jpeg: 'jpg',
  svg: 'svg',
};

/**
 * Arkivnamnet som filnamn. Svenska tecken får vara kvar — de överlever både
 * macOS, Windows och Google Classroom — men allt annat blir bindestreck.
 */
export const toFileSlug = (value: string | null | undefined): string => {
  const slug = (value ?? '')
    .normalize('NFC')
    .replace(/[^a-zA-Z0-9åäöÅÄÖ]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'schema';
};

export const buildExportFilename = (
  input: Pick<ScheduleExportInput, 'archiveName' | 'pageMode'>,
  format: ExportFormat
) => `schema-${toFileSlug(input.archiveName)}-${input.pageMode}.${EXTENSION[format]}`;

const download = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoke direkt sviker Safari — låt nedladdningen hinna starta först.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
};

export const exportSchedule = async (
  input: ScheduleExportInput,
  format: ExportFormat
): Promise<ExportOutcome> => {
  const scene = buildScene(input, createJsPdfMeasurer());
  const filename = buildExportFilename(input, format);

  if (format === 'pdf') {
    download(sceneToPdf(scene).output('blob'), filename);
  } else if (format === 'svg') {
    download(new Blob([sceneToSvg(scene)], { type: 'image/svg+xml' }), filename);
  } else {
    download(await sceneToRaster(scene, format), filename);
  }

  return {
    truncatedInstanceIds: scene.truncatedInstanceIds,
    isLowScale: scene.transform.isLowScale,
    filename,
  };
};
