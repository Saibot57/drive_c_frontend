'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Box, FormData } from '../types';
import { generateBoxColor } from '@/config/colorManagement';
import { getScheduleConfig } from '@/config/scheduleConfig';

interface BoxCreationFormProps {
  boxes: Box[];
  setBoxes: React.Dispatch<React.SetStateAction<Box[]>>;
}

export function BoxCreationForm({ boxes, setBoxes }: BoxCreationFormProps) {
  const [formData, setFormData] = React.useState<FormData>({
    className: '',
    teacher: '',
    duration: 60 // Default to 60 minutes
  });

  const config = getScheduleConfig();
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Check if the class already exists
    const existingClassIndex = boxes.findIndex(
      (box) => box.className === formData.className && box.teacher === formData.teacher
    );

    const quantity = parseInt(prompt('Hur många enheter vill du skapa?', '1') || '0', 10);
    if (isNaN(quantity) || quantity <= 0) {
      alert('Ogiltigt antal enheter. Ange ett positivt heltal.');
      return;
    }

    // Calculate timeSlotSpan based on duration if variable duration is enabled
    let timeSlotSpan = 1;
    if (config.allowVariableDuration && formData.duration && formData.duration !== 60) {
      // Find the closest number of slots based on the standard slot duration
      const standardSlotDuration = 60; // Most slots are 60 minutes
      timeSlotSpan = Math.ceil(formData.duration / standardSlotDuration);
    }

    if (existingClassIndex > -1) {
      // If the class exists, increment its quantity
      setBoxes((prev) =>
        prev.map((box, index) =>
          index === existingClassIndex
            ? { 
                ...box, 
                quantity: (box.quantity || 0) + quantity,
                duration: formData.duration, // Update duration if it changed
                timeSlotSpan: timeSlotSpan
              }
            : box
        )
      );
    } else {
      // If the class does not exist, create a new one with a generated color
      const newBox: Box = {
        id: Date.now(),
        className: formData.className,
        teacher: formData.teacher,
        color: generateBoxColor(formData.className),
        quantity: quantity,
        usageCount: 0,
        duration: formData.duration,
        timeSlotSpan: timeSlotSpan
      };
      setBoxes((prev) => [...prev, newBox]);
    }

    setFormData({ className: '', teacher: '', duration: 60 });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-monument">Skapa ny låda</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Klassnamn
            </label>
            <Input
              type="text"
              value={formData.className}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, className: e.target.value }))
              }
              className="schedule-input"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lärare
            </label>
            <Input
              type="text"
              value={formData.teacher}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, teacher: e.target.value }))
              }
              className="schedule-input"
              required
            />
          </div>
          
          {config.allowVariableDuration && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Längd (minuter)
              </label>
              <Input
                type="number"
                value={formData.duration}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, duration: parseInt(e.target.value) }))
                }
                className="schedule-input"
                min="15"
                step="15"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Standard längd är 60 minuter. Ändra bara om nödvändigt.
              </p>
            </div>
          )}
          
          <Button
            type="submit"
            variant="default"
            className="w-full schedule-button schedule-button-primary"
          >
            Skapa ny låda
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}