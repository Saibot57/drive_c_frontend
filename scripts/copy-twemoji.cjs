// Kopierar alla Twemoji-SVG:er till public/twemoji (körs på install/build)
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'node_modules', 'twemoji', 'assets', 'svg');
const destDir = path.join(__dirname, '..', 'public', 'twemoji');

fs.mkdirSync(destDir, { recursive: true });
for (const file of fs.readdirSync(srcDir)) {
  if (file.endsWith('.svg')) {
    fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
  }
}
console.log(`✅ Twemoji kopierat till ${destDir}`);
