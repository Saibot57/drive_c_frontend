'use client';

import React, { useState, useEffect, useRef } from 'react';
import { BoxCreationForm } from './components/BoxCreationForm';
import { BoxList } from './components/BoxList';
import { FilterPanel } from './components/FilterPanel';
import { SearchPanel } from './components/SearchPanel';
import { ScheduleGrid } from './components/ScheduleGrid';
import { RestrictionsPanel } from './components/RestrictionsPanel';
import { Statistics } from './components/Statistics';
import { ConfigPanel } from './components/ConfigPanel';
import { HeaderActions } from './components/HeaderActions';
import type { Box, Schedule, Filter, Restriction, SearchCriterion, ScheduleState } from './types';
import { filterScheduleBySearch } from './utils/schedule';
import { getScheduleConfig, updateScheduleConfig } from '@/config/scheduleConfig';
import { exportToPDF, showPrintDialog, ExportOptions } from './utils/export';

export default function ScheduleApp() {
  // State management
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [schedule, setSchedule] = useState<Schedule>({});
  const [draggedBox, setDraggedBox] = useState<Box | null>(null);
  const [restrictions, setRestrictions] = useState<Restriction[]>([]);
  const [showRestrictions, setShowRestrictions] = useState(false);
  const [searchCriteria, setSearchCriteria] = useState<SearchCriterion[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [filter, setFilter] = useState<Filter>({
    label1: '',
    label2: '',
    condition: 'both'
  });

  const scheduleRef = useRef<HTMLDivElement>(null);

  // Load saved state on initial render
  useEffect(() => {
    const savedState = localStorage.getItem('scheduleState');
    if (savedState) {
      try {
        const parsedState = JSON.parse(savedState) as ScheduleState;
        const { boxes, schedule, restrictions, configOverrides } = parsedState;
        
        setBoxes(
          boxes.map((box: Box) => ({
            ...box,
            initialQuantity: box.initialQuantity || box.quantity
          }))
        );
        setSchedule(schedule);
        setRestrictions(restrictions);
        
        // Apply saved config if available
        if (configOverrides) {
          updateScheduleConfig(configOverrides);
        }
      } catch (error) {
        console.error('Failed to load state from local storage:', error);
      }
    }
  }, []);

  // Save state on updates
  useEffect(() => {
    try {
      const currentConfig = getScheduleConfig();
      localStorage.setItem(
        'scheduleState',
        JSON.stringify({
          boxes: boxes.map(box => ({
            ...box,
            initialQuantity: box.initialQuantity || box.quantity
          })),
          schedule,
          restrictions,
          configOverrides: currentConfig
        })
      );
    } catch (error) {
      console.error('Failed to save state to local storage:', error);
    }
  }, [boxes, schedule, restrictions]);

  const handleDragStart = (e: React.DragEvent, box: Box) => {
    setDraggedBox(box);
    e.dataTransfer.setData('boxId', box.id.toString());
    e.dataTransfer.setData('text/plain', ''); // Required for Firefox
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (day: string, timeSlotId: string, slotIndex: number) => {
    if (!draggedBox) return;
    
    const slotKey = `${day}-${timeSlotId}-${slotIndex}`;
    
    // Add the box to the schedule
    setSchedule(prev => ({ ...prev, [slotKey]: draggedBox.id }));
    
    // If box has timeSlotSpan > 1, we need to handle multi-slot placement
    if (draggedBox.timeSlotSpan && draggedBox.timeSlotSpan > 1) {
      // This would require more complex placement logic that spans multiple timeSlots
      // For simplicity, this implementation just notes that it's a multi-slot box
      console.log(`Box ${draggedBox.className} spans ${draggedBox.timeSlotSpan} slots`);
    }
    
    // Update box quantity
    setBoxes(prev =>
      prev.map(box =>
        box.id === draggedBox.id
          ? { ...box, quantity: box.quantity - 1, usageCount: box.usageCount + 1 }
          : box
      )
    );
  };

  const handleSlotClick = (day: string, timeSlotId: string, slotIndex: number) => {
    const slotKey = `${day}-${timeSlotId}-${slotIndex}`;
    if (schedule[slotKey]) {
      const boxId = schedule[slotKey];
      
      // Return the box to available boxes
      setBoxes(prev =>
        prev.map(box =>
          box.id === boxId
            ? { ...box, quantity: box.quantity + 1 }
            : box
        )
      );
      
      // Remove from schedule
      setSchedule(prev => {
        const newSchedule = { ...prev };
        delete newSchedule[slotKey];
        return newSchedule;
      });
    }
  };

  const handleConfigChange = (newConfig: any) => {
    // When config changes, we need to adapt the schedule
    console.log('Schedule config updated', newConfig);
  };

  const handleClearSchedule = () => {
    if (window.confirm('Är du säker på att du vill rensa schemat?')) {
      localStorage.removeItem('scheduleState');
      localStorage.removeItem('schedule');
      localStorage.removeItem('boxes');
      window.location.reload();
    }
  };

  const handleExportSchedule = async () => {
    try {
      setIsExporting(true);
      const savedState = localStorage.getItem('scheduleState');
      if (!savedState) {
        throw new Error('No schedule state found');
      }

      const scheduleState: ScheduleState = JSON.parse(savedState);
      const blob = new Blob([JSON.stringify(scheduleState, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `schema-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export misslyckades. Försök igen.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportSchedule = async () => {
    try {
      setIsImporting(true);
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';

      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onerror = (error) => {
          console.error('FileReader error:', error);
          alert('Läsning av filen misslyckades.');
        };

        reader.onload = (event) => {
          try {
            const content = event.target?.result as string;
            const data: ScheduleState = JSON.parse(content);

            if (!data.boxes || !Array.isArray(data.boxes)) {
              throw new Error('Invalid boxes data');
            }
            if (!data.schedule || typeof data.schedule !== 'object') {
              throw new Error('Invalid schedule data');
            }
            if (!Array.isArray(data.restrictions)) {
              throw new Error('Invalid restrictions data');
            }

            data.boxes = data.boxes.map((box: Box) => ({
              id: box.id,
              className: box.className,
              teacher: box.teacher,
              color: box.color,
              quantity: box.quantity,
              usageCount: box.usageCount || 0,
              initialQuantity: box.initialQuantity || box.quantity,
              duration: box.duration || 60,
              timeSlotSpan: box.timeSlotSpan || 1
            }));

            const stateToSave: ScheduleState = {
              boxes: data.boxes,
              schedule: data.schedule,
              restrictions: data.restrictions,
              configOverrides: data.configOverrides
            };

            localStorage.setItem('scheduleState', JSON.stringify(stateToSave));
            window.location.reload();
          } catch (error) {
            console.error('Import processing failed:', error);
            alert('Import misslyckades. Kontrollera filformatet: ' + (error as Error).message);
          }
        };

        reader.readAsText(file);
      };

      input.click();
    } catch (error) {
      console.error('Import failed:', error);
      alert('Import misslyckades. Försök igen.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleSaveSchedule = async (options?: ExportOptions) => {
    try {
      setIsSaving(true);
      const scheduleElement =
        document.querySelector('[ref="scheduleRef"]') ||
        document.querySelector('.neo-brutal-schedule') ||
        document.querySelector('.mb-8.overflow-x-auto');

      if (!scheduleElement) {
        throw new Error('Schedule element not found');
      }

      // If no options provided, show export dialog
      if (!options) {
        showPrintDialog(scheduleElement as HTMLDivElement, (exportOptions) => {
          handleSaveSchedule(exportOptions);
        });
        setIsSaving(false);
        return;
      }

      await exportToPDF(scheduleElement as HTMLDivElement, options);
    } catch (error) {
      console.error('PDF export failed:', error);
      alert('PDF export misslyckades. Försök igen.');
    } finally {
      setIsSaving(false);
    }
  };

  // Filter schedule based on search criteria
  const filteredSchedule = filterScheduleBySearch(schedule, boxes, searchCriteria);

  return (
    <div className="w-full mx-auto px-0">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-4xl font-monument">Schemaläggning</h1>
        <HeaderActions
          onClearSchedule={handleClearSchedule}
          onExportSchedule={handleExportSchedule}
          onImportSchedule={handleImportSchedule}
          onSaveSchedule={handleSaveSchedule}
          isExporting={isExporting}
          isImporting={isImporting}
          isSaving={isSaving}
        />
      </div>
      
      <ConfigPanel onConfigChange={handleConfigChange} />
      
      <SearchPanel onSearch={setSearchCriteria} />
      <FilterPanel filter={filter} setFilter={setFilter} />
      
      <ScheduleGrid
        boxes={boxes}
        schedule={filteredSchedule}
        restrictions={restrictions}
        filter={filter}
        draggedBox={draggedBox}
        scheduleRef={scheduleRef}
        onDrop={handleDrop}
        onSlotClick={handleSlotClick}
        onSlotHover={(day, timeSlotId) => {
          // Handle hover state directly in the callback
        }}
      />
      
      <div className="flex flex-col md:flex-row gap-4">
        {/* Left side - Available Boxes */}
        <div className="w-full md:w-3/4">
          <BoxList
            boxes={boxes}
            schedule={filteredSchedule}
            setBoxes={setBoxes}
            onDragStart={handleDragStart}
          />
        </div>
        
        {/* Right side - Form and Statistics */}
        <div className="w-full md:w-1/4 space-y-4">
          <BoxCreationForm
            boxes={boxes}
            setBoxes={setBoxes}
          />
          
          <Statistics
            boxes={boxes}
            schedule={filteredSchedule}
            scheduleRef={scheduleRef}
            setBoxes={setBoxes}
            setSchedule={setSchedule}
            setRestrictions={setRestrictions}
          />
        </div>
      </div>
      
      <RestrictionsPanel
        restrictions={restrictions}
        showRestrictions={showRestrictions}
        setRestrictions={setRestrictions}
        setShowRestrictions={setShowRestrictions}
      />
    </div>
  );
}