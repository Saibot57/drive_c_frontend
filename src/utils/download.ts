import type { jsPDF } from 'jspdf';

/**
 * En titel som filnamn. Svenska tecken får vara kvar — de överlever både
 * macOS, Windows och Google Classroom — men allt annat blir bindestreck.
 */
export const toFileSlug = (value: string | null | undefined, fallback = 'schema'): string => {
  const slug = (value ?? '')
    .normalize('NFC')
    .replace(/[^a-zA-Z0-9åäöÅÄÖ]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || fallback;
};

/** Laddar ner en data- eller blob-adress under ett filnamn. */
export const downloadUrl = (href: string, filename: string) => {
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
};

/** Laddar ner en blob. Adressen släpps först när nedladdningen hunnit starta. */
export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  downloadUrl(url, filename);
  // Revoke direkt sviker Safari — låt nedladdningen hinna starta först.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
};

/** Lägger en canvas så stor som möjligt, centrerad, innanför sidans marginal. */
export const addCanvasCentered = (pdf: jsPDF, canvas: HTMLCanvasElement, margin: number) => {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const scale = Math.min(
    (pageWidth - margin * 2) / canvas.width,
    (pageHeight - margin * 2) / canvas.height,
  );
  const width = canvas.width * scale;
  const height = canvas.height * scale;
  pdf.addImage(
    canvas.toDataURL('image/png'),
    'PNG',
    (pageWidth - width) / 2,
    (pageHeight - height) / 2,
    width,
    height,
  );
};
