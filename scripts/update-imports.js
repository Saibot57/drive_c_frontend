// scripts/update-imports.js
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FILES_TO_UPDATE = [
  '../src/app/features/calendar/page.tsx',
  '../src/components/calendar/Calendar.tsx',
  '../src/components/calendar/DayCard.tsx',
  '../src/components/calendar/EventCard.tsx',
  '../src/components/calendar/TimeGrid.tsx',
];

const IMPORT_UPDATES = {
  '@/components/Calendar/': '@/components/calendar/',
  './Calendar': './Calendar',
  './DayCard': './DayCard',
  './EventCard': './EventCard',
  './TimeGrid': './TimeGrid',
  './types': './types'
};

async function updateFile(filePath) {
  const fullPath = resolve(__dirname, filePath);
  try {
    console.log(`Processing ${fullPath}...`);
    let content = await fs.readFile(fullPath, 'utf8');
    let hasChanges = false;

    for (const [oldImport, newImport] of Object.entries(IMPORT_UPDATES)) {
      if (content.includes(oldImport)) {
        content = content.replace(new RegExp(oldImport, 'g'), newImport);
        hasChanges = true;
        console.log(`  Updated: ${oldImport} -> ${newImport}`);
      }
    }

    if (hasChanges) {
      await fs.writeFile(fullPath, content, 'utf8');
      console.log(`  Saved changes to ${fullPath}`);
    } else {
      console.log(`  No changes needed in ${fullPath}`);
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`  File not found: ${fullPath}`);
    } else {
      console.error(`Error processing ${fullPath}:`, error);
    }
  }
}

async function main() {
  console.log('Starting import updates...');
  for (const file of FILES_TO_UPDATE) {
    await updateFile(file);
  }
  console.log('Finished processing all files.');
}

main().catch(console.error);