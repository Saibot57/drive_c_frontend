/**
 * Exportens ytterdörr.
 *
 * Bygger scenen ur schemadatan, renderar den till valt format och laddar ner
 * filen. Ingen systemutskriftsdialog inblandad — filen skapas i kod, vilket
 * också är varför `truncated` går att rapportera ärligt: kommer vi hit har
 * filen faktiskt blivit till.
 */

import { ScheduleExportInput } from '@/types/scheduleExport';
import { downloadBlob, toFileSlug } from '@/utils/download';
import { buildScene } from './buildScene';
import { createJsPdfMeasurer } from './jspdfMeasurer';
import { sceneToPdf, scenesToPdf } from './sceneToPdf';
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

export const buildExportFilename = (
  input: Pick<ScheduleExportInput, 'archiveName' | 'pageMode'>,
  format: ExportFormat
) => `schema-${toFileSlug(input.archiveName)}-${input.pageMode}.${EXTENSION[format]}`;

export const exportSchedule = async (
  input: ScheduleExportInput,
  format: ExportFormat
): Promise<ExportOutcome> => {
  const scene = buildScene(input, createJsPdfMeasurer());
  const filename = buildExportFilename(input, format);

  if (format === 'pdf') {
    downloadBlob(sceneToPdf(scene).output('blob'), filename);
  } else if (format === 'svg') {
    downloadBlob(new Blob([sceneToSvg(scene)], { type: 'image/svg+xml' }), filename);
  } else {
    downloadBlob(await sceneToRaster(scene, format), filename);
  }

  return {
    truncatedInstanceIds: scene.truncatedInstanceIds,
    isLowScale: scene.transform.isLowScale,
    filename,
  };
};

/**
 * Flera scheman i en PDF, ett per sida, till exempel ett per lärare. Bara PDF:
 * en bild är en fil, och många nedladdningar i rad stoppas av webbläsaren.
 * Filnamnet byggs ur `naming`, eftersom sidornas rubriker är olika.
 */
export const exportScheduleBook = (
  inputs: ScheduleExportInput[],
  naming: Pick<ScheduleExportInput, 'archiveName' | 'pageMode'>
): ExportOutcome => {
  const measure = createJsPdfMeasurer();
  const scenes = inputs.map(input => buildScene(input, measure));
  const filename = buildExportFilename(naming, 'pdf');

  downloadBlob(scenesToPdf(scenes).output('blob'), filename);

  return {
    truncatedInstanceIds: scenes.flatMap(scene => scene.truncatedInstanceIds),
    isLowScale: scenes.some(scene => scene.transform.isLowScale),
    filename,
  };
};
