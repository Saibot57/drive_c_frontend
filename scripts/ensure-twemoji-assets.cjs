const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'node_modules', '@twemoji', 'svg');
const twemojiDir = path.join(__dirname, '..', 'node_modules', 'twemoji');
const destDir = path.join(twemojiDir, 'assets');
const destSvgDir = path.join(destDir, 'svg');

if (!fs.existsSync(srcDir)) {
  console.error('❌ Hittar inte @twemoji/svg – kan inte förbereda SVG:er.');
  process.exit(1);
}

fs.mkdirSync(destDir, { recursive: true });

try {
  if (fs.existsSync(destSvgDir)) {
    const stat = fs.lstatSync(destSvgDir);
    if (stat.isSymbolicLink()) {
      const current = path.resolve(path.dirname(destSvgDir), fs.readlinkSync(destSvgDir));
      if (current === srcDir) {
        console.log('ℹ️ Twemoji assets redan länkade.');
        process.exit(0);
      }
      fs.unlinkSync(destSvgDir);
    } else {
      fs.rmSync(destSvgDir, { recursive: true, force: true });
    }
  }
  fs.symlinkSync(srcDir, destSvgDir, 'junction');
  console.log(`✅ Länkat ${destSvgDir} → ${srcDir}`);
} catch (error) {
  console.warn('⚠️ Kunde inte skapa symlink, kopierar filer istället.', error.message);
  fs.mkdirSync(destSvgDir, { recursive: true });
  for (const file of fs.readdirSync(srcDir)) {
    if (file.endsWith('.svg')) {
      fs.copyFileSync(path.join(srcDir, file), path.join(destSvgDir, file));
    }
  }
  console.log(`✅ Kopierade SVG:er till ${destSvgDir}`);
}
