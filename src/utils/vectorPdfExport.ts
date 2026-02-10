type VectorPdfExportOptions = {
  filename?: string;
  title?: string;
  extraClassNames?: string[];
  clipHeightPx?: number;
};

const collectStyles = () => {
  let combined = '';
  let imports = '';
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const rules = sheet.cssRules;
      if (!rules) continue;
      for (const rule of Array.from(rules)) {
        if (rule instanceof CSSImportRule) {
          imports += `${rule.cssText}\n`;
        } else {
          combined += `${rule.cssText}\n`;
        }
      }
    } catch (error) {
      console.warn('Unable to read stylesheet for PDF export.', error);
    }
  }
  return `${imports}${combined}`;
};

const waitForImages = async (doc: Document) => {
  const images = Array.from(doc.images);
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.addEventListener('load', () => resolve(), { once: true });
          img.addEventListener('error', () => resolve(), { once: true });
        })
    )
  );
};

export const exportElementToVectorPdf = async (
  element: HTMLElement,
  options: VectorPdfExportOptions = {}
) => {
  if (!element) throw new Error('exportElementToVectorPdf: element is null');

  const filename = options.filename ?? 'export.pdf';
  const title = options.title ?? filename.replace(/\.pdf$/i, '');

  const clonedElement = element.cloneNode(true) as HTMLElement;
  const targetWidth = Math.max(element.scrollWidth, element.clientWidth);
  const targetHeight = Math.max(element.scrollHeight, element.clientHeight);
  const clippedHeight = Number.isFinite(options.clipHeightPx)
    ? Math.min(targetHeight, options.clipHeightPx as number)
    : targetHeight;
  const shouldClipHeight = Number.isFinite(options.clipHeightPx);
  clonedElement.style.width = `${targetWidth}px`;
  clonedElement.style.height = `${clippedHeight}px`;
  clonedElement.style.overflow = shouldClipHeight ? 'hidden' : 'visible';
  options.extraClassNames?.forEach((className) =>
    clonedElement.classList.add(className)
  );

  const styles = collectStyles();
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
      body { margin: 0; background: #fff; }
      ${styles}
    </style>
  </head>
  <body></body>
</html>`);
  doc.close();

  if (!doc.body) {
    document.body.removeChild(iframe);
    return;
  }

  doc.body.appendChild(clonedElement);

  await new Promise<void>((resolve) => {
    const targetWindow = iframe.contentWindow;
    if (!targetWindow) {
      resolve();
      return;
    }
    targetWindow.requestAnimationFrame(() => resolve());
  });

  const fonts = (doc as Document & { fonts?: { ready?: Promise<unknown> } })
    .fonts;
  if (fonts?.ready) {
    await fonts.ready;
  }

  await waitForImages(doc);

  const targetWindow = iframe.contentWindow;
  if (!targetWindow) {
    document.body.removeChild(iframe);
    return;
  }

  const cleanup = () => {
    document.body.removeChild(iframe);
  };

  targetWindow.focus();
  targetWindow.print();

  targetWindow.addEventListener('afterprint', cleanup, { once: true });
  window.setTimeout(cleanup, 1000);
};
