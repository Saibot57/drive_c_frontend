/**
 * Scen → skarp rasterbild, via SVG.
 *
 * Finns för att PDF inte förhandsvisas inline i chattappar — där behövs en
 * bild. Den ritas ur samma scen som PDF:en i stället för att fota DOM:en, så
 * den slipper html2canvas 2x-tak och dess egenheter.
 *
 * Radbrytningen är redan gjord av scenbyggaren, så webbläsarens fontmetrik kan
 * på sin höjd flytta enskilda rader någon px — den kan aldrig bryta om texten.
 *
 * Bara webbläsare: kräver `Image`, `canvas` och `URL.createObjectURL`.
 */

import { ScheduleScene } from './scene';
import { sceneToSvg } from './sceneToSvg';

/** 3x ger ~288 dpi vid schemats egna mått — skarpt även när mottagaren zoomar. */
export const PNG_SCALE = 3;

export type RasterFormat = 'png' | 'jpeg';

export const sceneToRaster = async (
  scene: ScheduleScene,
  format: RasterFormat = 'png',
  scale = PNG_SCALE
): Promise<Blob> => {
  const svg = sceneToSvg(scene);
  const svgUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));

  try {
    const image = await loadImage(svgUrl);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(scene.widthPx * scale);
    canvas.height = Math.round(scene.heightPx * scale);

    const context = canvas.getContext('2d');
    if (!context) throw new Error('sceneToRaster: 2d-kontext saknas');
    // JPEG har ingen alfakanal — utan detta blir genomskinligheten svart.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    return await toBlob(canvas, format);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
};

const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('sceneToRaster: kunde inte läsa SVG:n'));
    image.src = url;
  });

const toBlob = (canvas: HTMLCanvasElement, format: RasterFormat) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('sceneToRaster: tom bild'))),
      `image/${format}`,
      format === 'jpeg' ? 0.92 : undefined
    );
  });
