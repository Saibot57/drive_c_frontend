// Content shape for 'image' workspace elements. Stored as JSON in
// WorkspaceElement.content — no DB migration needed, only
// WorkspaceElement.VALID_TYPES is extended with 'image'.
//
// Source types are identical to PdfSource (gdrive, url).

import type { PdfSource } from './pdf.types';

export type ImageSource = PdfSource;

/**
 * 'preview' är Drives förhandsbild (längsta sidan 1600 px), 'full' hela
 * filen. Gäller bara Drive-bilder; en direktlänk hämtas alltid hel.
 */
export type ImageResolution = 'preview' | 'full';

export const DEFAULT_IMAGE_RESOLUTION: ImageResolution = 'preview';

export interface ImageContent {
  source: ImageSource | null;
  fileName?: string;
  /** Saknas i kort sparade före valet och betyder då DEFAULT_IMAGE_RESOLUTION. */
  resolution?: ImageResolution;
}
