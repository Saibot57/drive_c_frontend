// Copies the pdf.js worker into public/pdfjs so Next.js serves it as a
// static asset at /pdfjs/pdf.worker.min.mjs. Mirrors the twemoji approach
// (see copy-twemoji.cjs) — avoids all the next.config / Turbopack worker
// headaches and keeps pdfjs-dist out of the Next.js bundler.
const fs = require('fs');
const path = require('path');

const candidates = [
  // Preferred: the modern ESM worker build
  path.join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs'),
  // Fallback: legacy CJS build (older pdfjs-dist versions or if mjs is missing)
  path.join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.min.js'),
];

const destDir = path.join(__dirname, '..', 'public', 'pdfjs');
fs.mkdirSync(destDir, { recursive: true });

let copied = false;
for (const src of candidates) {
  if (fs.existsSync(src)) {
    const destName = path.basename(src);
    const dest = path.join(destDir, destName);
    fs.copyFileSync(src, dest);
    console.log(`✅ pdf.js worker kopierad: ${destName}`);
    copied = true;
    break;
  }
}

if (!copied) {
  console.warn(
    '⚠️  Kunde inte hitta pdf.worker i node_modules/pdfjs-dist. ' +
      'Kör `pnpm install pdfjs-dist` och försök igen.',
  );
}
