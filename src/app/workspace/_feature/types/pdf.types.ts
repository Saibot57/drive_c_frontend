// Content shape for 'pdf' workspace elements. Stored as JSON in
// WorkspaceElement.content (Text column on the backend) — no DB migration
// needed, only WorkspaceElement.VALID_TYPES is extended with 'pdf'.
//
// v1 supported sources:
//   - gdrive:   Google Drive file the user owns (resolved via backend proxy,
//               which ownership-checks against the DriveFile table).
//   - onedrive: "Anyone with link" OneDrive/SharePoint share URL. PRIVATE
//               OneDrive files are NOT supported in v1 — that requires a
//               Microsoft Graph OAuth integration we have not built.
//   - url:      Any public HTTPS PDF URL. The backend enforces SSRF guard,
//               content-type, and size limits.

export type PdfSource =
  | { kind: 'gdrive'; fileId: string }
  | { kind: 'onedrive'; shareUrl: string }
  | { kind: 'url'; url: string };

export interface PdfContent {
  source: PdfSource | null;
  fileName?: string;
  /** Last viewed page — persisted so the reader reopens on the same spot. */
  page?: number;
}

export const EMPTY_PDF_CONTENT: PdfContent = {
  source: null,
};
