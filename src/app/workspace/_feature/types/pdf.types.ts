// Content shape for 'pdf' workspace elements. Stored as JSON in
// WorkspaceElement.content (Text column on the backend) — no DB migration
// needed, only WorkspaceElement.VALID_TYPES is extended with 'pdf'.
//
// Supported sources (OneDrive togs bort 2026-10-24; gamla kort med
// kind 'onedrive' får ett felbesked från backend och kan byta länk):
//   - gdrive:   Google Drive file the user owns (resolved via backend proxy,
//               which ownership-checks against the DriveFile table).
//   - url:      Any public HTTPS PDF URL. The backend enforces SSRF guard,
//               content-type, and size limits.

export type PdfSource =
  | { kind: 'gdrive'; fileId: string }
  | { kind: 'url'; url: string };

export interface PdfContent {
  source: PdfSource | null;
  fileName?: string;
  /** Last viewed page — persisted so the reader reopens on the same spot. */
  page?: number;
}
