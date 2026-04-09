import { fetchWithAuth } from '@/services/authService';
import { API_URL } from '@/config/api';
import type { PdfSource } from '../types/pdf.types';

/**
 * Parse a user-pasted share link into a typed PdfSource.
 *
 * Recognises:
 *   - Google Drive:   https://drive.google.com/file/d/{id}/view?...
 *                     https://drive.google.com/open?id={id}
 *                     https://drive.google.com/uc?id={id}
 *   - OneDrive:       https://1drv.ms/...
 *                     https://onedrive.live.com/...
 *                     https://*.sharepoint.com/...
 *   - Generic:        any https?:// URL (backend SSRF/type-checks it)
 *
 * Returns null if the input is empty or clearly not a URL.
 */
export function parseSource(rawInput: string): PdfSource | null {
  const input = rawInput.trim();
  if (!input) return null;

  // ── Google Drive patterns ──
  const gdriveFileMatch = input.match(/drive\.google\.com\/file\/d\/([^/?#]+)/i);
  if (gdriveFileMatch) {
    return { kind: 'gdrive', fileId: gdriveFileMatch[1] };
  }
  const gdriveOpenMatch = input.match(/drive\.google\.com\/(?:open|uc)\?.*?id=([^&]+)/i);
  if (gdriveOpenMatch) {
    return { kind: 'gdrive', fileId: gdriveOpenMatch[1] };
  }

  // ── OneDrive / SharePoint ──
  if (/^https?:\/\/(1drv\.ms|[\w.-]*onedrive\.live\.com|[\w.-]+\.sharepoint\.com)\//i.test(input)) {
    return { kind: 'onedrive', shareUrl: input };
  }

  // ── Generic URL ──
  if (/^https?:\/\//i.test(input)) {
    return { kind: 'url', url: input };
  }

  return null;
}

/**
 * Fetch the PDF bytes via the backend proxy. We deliberately pull into an
 * ArrayBuffer on the client and hand it to pdfjs via `{ data }` — this keeps
 * auth in one place (fetchWithAuth sets the JWT header) and avoids having
 * pdfjs's worker make an unauthenticated GET.
 */
export async function fetchPdfBytes(source: PdfSource): Promise<ArrayBuffer> {
  const res = await fetchWithAuth(`${API_URL}/workspace/pdf-proxy`, {
    method: 'POST',
    body: JSON.stringify({ source }),
  });
  if (!res.ok) {
    // The proxy returns the standard JSON envelope on errors.
    let message = `Kunde inte hämta PDF (HTTP ${res.status}).`;
    try {
      const json = await res.json();
      if (json?.error) message = json.error;
    } catch {
      /* non-JSON response — keep generic message */
    }
    throw new Error(message);
  }
  return res.arrayBuffer();
}
