import { fetchWithAuth } from '@/services/authService';
import { API_URL } from '@/config/api';
import type { ImageSource } from '../types/image.types';
import { parseSource } from './pdfProxyService';

// Re-export parseSource — the URL-parsing logic is identical for images.
export { parseSource };

/**
 * Fetch image bytes via the backend proxy.
 * Returns a Blob so the caller can create a blob: URL for <img>.
 */
export async function fetchImageBytes(source: ImageSource): Promise<Blob> {
  const res = await fetchWithAuth(`${API_URL}/workspace/image-proxy`, {
    method: 'POST',
    body: JSON.stringify({ source }),
  });
  if (!res.ok) {
    let message = `Kunde inte hämta bild (HTTP ${res.status}).`;
    try {
      const json = await res.json();
      if (json?.error) message = json.error;
    } catch {
      /* non-JSON response — keep generic message */
    }
    throw new Error(message);
  }
  return res.blob();
}
