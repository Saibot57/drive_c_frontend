// Content shape for 'image' workspace elements. Stored as JSON in
// WorkspaceElement.content — no DB migration needed, only
// WorkspaceElement.VALID_TYPES is extended with 'image'.
//
// Source types are identical to PdfSource (gdrive, onedrive, url).

import type { PdfSource } from './pdf.types';

export type ImageSource = PdfSource;

export interface ImageContent {
  source: ImageSource | null;
  fileName?: string;
}

export const EMPTY_IMAGE_CONTENT: ImageContent = {
  source: null,
};
