import type { Box, Schedule, Restriction } from '../types';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { getScheduleConfig } from '@/config/scheduleConfig';

interface ScheduleData {
  boxes: Box[];
  schedule: Schedule;
  restrictions: Restriction[];
  exportDate: string;
  configOverrides?: any;
}

export type PaperSize = 'a4' | 'a3' | 'letter' | 'legal';
export type Orientation = 'portrait' | 'landscape';

export interface ExportOptions {
  paperSize?: PaperSize;
  orientation?: Orientation;
  title?: string;
  fitToPage?: boolean;
  quality?: number; // 0-1
  showLegend?: boolean;
}

const PAPER_DIMENSIONS = {
  a4: { width: 210, height: 297 }, // mm
  a3: { width: 297, height: 420 }, // mm
  letter: { width: 216, height: 279 }, // mm (8.5" x 11")
  legal: { width: 216, height: 356 }, // mm (8.5" x 14")
};

export async function exportToPDF(
  scheduleRef: HTMLDivElement, 
  options: ExportOptions = {}
): Promise<void> {
  try {
    const {
      paperSize = 'a4',
      orientation = 'landscape',
      title = `Schema-${new Date().toISOString().split('T')[0]}`,
      fitToPage = true,
      quality = 2, // Higher quality for print
      showLegend = true
    } = options;

    // Create a temporary wrapper for proper rendering
    const tempWrapper = document.createElement('div');
    tempWrapper.style.position = 'absolute';
    tempWrapper.style.top = '-9999px';
    tempWrapper.style.left = '-9999px';
    tempWrapper.style.width = `${scheduleRef.scrollWidth}px`;
    tempWrapper.style.height = `${scheduleRef.scrollHeight}px`;
    tempWrapper.style.backgroundColor = 'white';
    tempWrapper.style.padding = '20px';
    
    // Clone the schedule element
    const clonedSchedule = scheduleRef.cloneNode(true) as HTMLElement;

    // Add print-specific styles
    clonedSchedule.classList.add('print-version');
    clonedSchedule.classList.remove('overflow-x-auto');
    clonedSchedule.classList.remove('mb-8');
    clonedSchedule.style.maxHeight = 'none';
    clonedSchedule.style.minHeight = 'auto';
    clonedSchedule.style.overflow = 'visible';
    clonedSchedule.style.height = 'auto';
    clonedSchedule.style.width = `${scheduleRef.scrollWidth}px`;
    
    // Add a legend if requested
    if (showLegend) {
      const legend = createLegend(scheduleRef);
      tempWrapper.appendChild(legend);
    }
    
    tempWrapper.appendChild(clonedSchedule);
    document.body.appendChild(tempWrapper);

    // Generate the canvas
    const canvas = await html2canvas(tempWrapper, {
      scale: quality,
      logging: false,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
    });

    // Create PDF with proper dimensions
    const { width: pWidth, height: pHeight } = PAPER_DIMENSIONS[paperSize];
    const pdfWidth = orientation === 'landscape' ? pHeight : pWidth;
    const pdfHeight = orientation === 'landscape' ? pWidth : pHeight;
    
    const pdf = new jsPDF({
      orientation: orientation,
      unit: 'mm',
      format: paperSize
    });

    // Calculate dimensions to fit the content properly
    let imgWidth = pdfWidth - 20; // 10mm margin on each side
    let imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    // If the image height is too large and fitToPage is true, scale down
    if (fitToPage && imgHeight > pdfHeight - 20) {
      imgHeight = pdfHeight - 20;
      imgWidth = (canvas.width * imgHeight) / canvas.height;
    }
    
    // Center the image on the page
    const xOffset = (pdfWidth - imgWidth) / 2;
    const yOffset = (pdfHeight - imgHeight) / 2;

    // Add title
    pdf.setFontSize(16);
    pdf.text(title, pdfWidth / 2, 10, { align: 'center' });

    // Add the schedule image
    pdf.addImage(
      canvas.toDataURL('image/jpeg', 1.0),
      'JPEG',
      xOffset,
      yOffset + 10, // Add space for the title
      imgWidth,
      imgHeight
    );

    // Add footer with date
    pdf.setFontSize(8);
    const dateStr = new Date().toLocaleString();
    pdf.text(`Genererad: ${dateStr}`, 10, pdfHeight - 5);

    // Save the PDF
    pdf.save(`${title}.pdf`);
    
    // Clean up
    document.body.removeChild(tempWrapper);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF');
  }
}

// Create a legend element showing classes and their colors
function createLegend(scheduleRef: HTMLElement): HTMLElement {
  const legend = document.createElement('div');
  legend.style.marginBottom = '20px';
  legend.style.display = 'flex';
  legend.style.flexWrap = 'wrap';
  legend.style.gap = '10px';
  
  // Extract unique class names and colors from the schedule
  const classes = new Map<string, string>(); // className -> color
  
  // Find all box elements and extract their class names and colors
  const boxElements = scheduleRef.querySelectorAll('[class*="cursor-move"]');
  boxElements.forEach(box => {
    const className = box.querySelector('div')?.textContent;
    const style = window.getComputedStyle(box);
    const color = style.backgroundColor;
    
    if (className && color && !classes.has(className)) {
      classes.set(className, color);
    }
  });
  
  // Create legend items
  classes.forEach((color, name) => {
    const item = document.createElement('div');
    item.style.display = 'flex';
    item.style.alignItems = 'center';
    
    const colorBox = document.createElement('div');
    colorBox.style.width = '15px';
    colorBox.style.height = '15px';
    colorBox.style.backgroundColor = color;
    colorBox.style.marginRight = '5px';
    colorBox.style.border = '1px solid black';
    
    const nameSpan = document.createElement('span');
    nameSpan.textContent = name;
    nameSpan.style.fontSize = '10px';
    
    item.appendChild(colorBox);
    item.appendChild(nameSpan);
    legend.appendChild(item);
  });
  
  return legend;
}

export function exportToJSON(boxes: Box[], schedule: Schedule, restrictions: Restriction[]): void {
  const config = getScheduleConfig();
  
  const scheduleData: ScheduleData = {
    boxes: boxes.map((box) => ({
      ...box,
      initialQuantity: box.initialQuantity || box.quantity,
    })),
    schedule,
    restrictions,
    exportDate: new Date().toISOString(),
    configOverrides: config
  };

  const blob = new Blob([JSON.stringify(scheduleData, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `schema-export-${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export function validateImportedData(data: unknown): data is ScheduleData {
  return (
    typeof data === 'object' &&
    data !== null &&
    Array.isArray((data as ScheduleData).boxes) &&
    typeof (data as ScheduleData).schedule === 'object' &&
    Array.isArray((data as ScheduleData).restrictions)
  );
}

// Function to determine the best PDF orientation based on schedule dimensions
export function determineBestOrientation(scheduleRef: HTMLDivElement): Orientation {
  const width = scheduleRef.scrollWidth;
  const height = scheduleRef.scrollHeight;
  
  // If width is greater than height, landscape is probably better
  return width > height ? 'landscape' : 'portrait';
}

// Function to add a print dialog with export options
export function showPrintDialog(
  scheduleRef: HTMLDivElement,
  onExport: (options: ExportOptions) => void
): void {
  // Create dialog element
  const dialog = document.createElement('div');
  dialog.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
  
  // Create content
  dialog.innerHTML = `
    <div class="bg-white p-6 rounded-lg shadow-lg max-w-md w-full neo-brutal-card">
      <h2 class="text-xl font-bold mb-4">Exportera schema</h2>
      
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium mb-1">Pappersformat</label>
          <select id="paper-size" class="w-full p-2 border rounded">
            <option value="a4">A4</option>
            <option value="a3">A3</option>
            <option value="letter">Letter</option>
            <option value="legal">Legal</option>
          </select>
        </div>
        
        <div>
          <label class="block text-sm font-medium mb-1">Orientering</label>
          <select id="orientation" class="w-full p-2 border rounded">
            <option value="landscape">Liggande</option>
            <option value="portrait">Stående</option>
          </select>
        </div>
        
        <div>
          <label class="block text-sm font-medium mb-1">Titel</label>
          <input type="text" id="title" class="w-full p-2 border rounded" value="Schema-${new Date().toISOString().split('T')[0]}">
        </div>
        
        <div class="flex items-center">
          <input type="checkbox" id="fit-page" class="mr-2" checked>
          <label for="fit-page">Anpassa till sida</label>
        </div>
        
        <div class="flex items-center">
          <input type="checkbox" id="show-legend" class="mr-2" checked>
          <label for="show-legend">Visa förklaring</label>
        </div>
      </div>
      
      <div class="mt-6 flex justify-end space-x-3">
        <button id="cancel-export" class="px-4 py-2 border rounded hover:bg-gray-100">Avbryt</button>
        <button id="confirm-export" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">Exportera</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(dialog);
  
  // Set recommended orientation based on schedule dimensions
  const recommendedOrientation = determineBestOrientation(scheduleRef);
  (document.getElementById('orientation') as HTMLSelectElement).value = recommendedOrientation;
  
  // Handle dialog actions
  document.getElementById('cancel-export')?.addEventListener('click', () => {
    document.body.removeChild(dialog);
  });
  
  document.getElementById('confirm-export')?.addEventListener('click', () => {
    const options: ExportOptions = {
      paperSize: (document.getElementById('paper-size') as HTMLSelectElement).value as PaperSize,
      orientation: (document.getElementById('orientation') as HTMLSelectElement).value as Orientation,
      title: (document.getElementById('title') as HTMLInputElement).value,
      fitToPage: (document.getElementById('fit-page') as HTMLInputElement).checked,
      showLegend: (document.getElementById('show-legend') as HTMLInputElement).checked
    };
    
    onExport(options);
    document.body.removeChild(dialog);
  });
}