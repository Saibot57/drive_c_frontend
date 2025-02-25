'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, X, Settings } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TimeSlot, getScheduleConfig, updateScheduleConfig, formatTimeSlot } from '@/config/scheduleConfig';

interface ConfigPanelProps {
  onConfigChange: (newConfig: any) => void;
}

export function ConfigPanel({ onConfigChange }: ConfigPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [config, setConfig] = useState(() => getScheduleConfig());
  const [newTimeSlot, setNewTimeSlot] = useState<Partial<TimeSlot>>({
    startTime: '',
    endTime: '',
    durationMinutes: 60
  });

  const handleConfigUpdate = (updatedConfig: any) => {
    setConfig(updatedConfig);
    const savedConfig = updateScheduleConfig(updatedConfig);
    onConfigChange(savedConfig);
  };

  const addDay = () => {
    const newDay = prompt('Ange namn på ny dag:');
    if (newDay && !config.days.includes(newDay)) {
      const updatedConfig = {
        ...config,
        days: [...config.days, newDay]
      };
      handleConfigUpdate(updatedConfig);
    }
  };

  const removeDay = (day: string) => {
    if (window.confirm(`Är du säker på att du vill ta bort dagen "${day}"?`)) {
      const updatedConfig = {
        ...config,
        days: config.days.filter(d => d !== day)
      };
      handleConfigUpdate(updatedConfig);
    }
  };

  const addTimeSlot = () => {
    if (!newTimeSlot.startTime || !newTimeSlot.endTime) {
      alert('Du måste ange både start- och sluttid.');
      return;
    }

    // Calculate duration if not provided
    if (!newTimeSlot.durationMinutes) {
      const startParts = newTimeSlot.startTime.split(':').map(Number);
      const endParts = newTimeSlot.endTime.split(':').map(Number);
      
      const startMinutes = startParts[0] * 60 + startParts[1];
      const endMinutes = endParts[0] * 60 + endParts[1];
      
      newTimeSlot.durationMinutes = endMinutes - startMinutes;
    }

    if (newTimeSlot.durationMinutes <= 0) {
      alert('Sluttiden måste vara efter starttiden.');
      return;
    }

    const newSlot: TimeSlot = {
      id: `custom-${Date.now()}`,
      startTime: newTimeSlot.startTime,
      endTime: newTimeSlot.endTime,
      durationMinutes: newTimeSlot.durationMinutes
    };

    // Sort time slots by start time
    const updatedTimeSlots = [...config.timeSlots, newSlot].sort((a, b) => {
      const aTime = a.startTime.split(':').map(Number);
      const bTime = b.startTime.split(':').map(Number);
      
      if (aTime[0] !== bTime[0]) return aTime[0] - bTime[0];
      return aTime[1] - bTime[1];
    });

    const updatedConfig = {
      ...config,
      timeSlots: updatedTimeSlots
    };

    handleConfigUpdate(updatedConfig);
    setNewTimeSlot({ startTime: '', endTime: '', durationMinutes: 60 });
  };

  const removeTimeSlot = (id: string) => {
    if (window.confirm('Är du säker på att du vill ta bort denna tid?')) {
      const updatedConfig = {
        ...config,
        timeSlots: config.timeSlots.filter(slot => slot.id !== id)
      };
      handleConfigUpdate(updatedConfig);
    }
  };

  const updateMaxSlotColumns = (value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue > 0) {
      const updatedConfig = {
        ...config,
        maxSlotColumns: numValue
      };
      handleConfigUpdate(updatedConfig);
    }
  };

  const updateHeightMultiplier = (value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue > 0) {
      const updatedConfig = {
        ...config,
        slotHeightMultiplier: numValue
      };
      handleConfigUpdate(updatedConfig);
    }
  };

  const toggleSetting = (setting: 'allowCustomTimeSlots' | 'allowVariableDuration') => {
    const updatedConfig = {
      ...config,
      [setting]: !config[setting]
    };
    handleConfigUpdate(updatedConfig);
  };

  return (
    <Card className="mt-4 mb-6">
      <CardHeader 
        className="cursor-pointer flex flex-row items-center justify-between"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center">
          <Settings className="mr-2 h-5 w-5" />
          <CardTitle className="text-lg font-monument">Schemainställningar</CardTitle>
        </div>
        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="space-y-6">
          {/* Days configuration */}
          <div>
            <h3 className="font-medium mb-2 font-monument">Dagar</h3>
            <div className="flex flex-wrap gap-2 mb-2">
              {config.days.map((day) => (
                <div key={day} className="flex items-center bg-white border-2 border-black px-3 py-1 rounded-lg">
                  <span>{day}</span>
                  <button 
                    onClick={() => removeDay(day)}
                    className="ml-2 text-red-500 hover:text-red-700"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              <Button 
                variant="neutral"
                size="sm" 
                onClick={addDay}
                className="flex items-center schedule-button"
              >
                <Plus size={14} className="mr-1" /> Lägg till dag
              </Button>
            </div>
          </div>

          {/* Time slots configuration */}
          <div>
            <h3 className="font-medium mb-2 font-monument">Tidsluckor</h3>
            <div className="space-y-2 mb-4">
              {config.timeSlots.map((slot) => (
                <div key={slot.id} className="flex items-center justify-between bg-white border-2 border-black px-3 py-2 rounded-lg">
                  <span>{formatTimeSlot(slot)} ({slot.durationMinutes} min)</span>
                  <button 
                    onClick={() => removeTimeSlot(slot.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2 mb-2">
              <div>
                <label className="block text-sm mb-1">Starttid</label>
                <Input 
                  type="time"
                  value={newTimeSlot.startTime}
                  onChange={(e) => setNewTimeSlot(prev => ({ ...prev, startTime: e.target.value }))}
                  className="schedule-input"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Sluttid</label>
                <Input 
                  type="time"
                  value={newTimeSlot.endTime}
                  onChange={(e) => setNewTimeSlot(prev => ({ ...prev, endTime: e.target.value }))}
                  className="schedule-input"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Längd (min)</label>
                <Input 
                  type="number"
                  value={newTimeSlot.durationMinutes}
                  onChange={(e) => setNewTimeSlot(prev => ({ 
                    ...prev, 
                    durationMinutes: parseInt(e.target.value) 
                  }))}
                  min="15"
                  step="5"
                  className="schedule-input"
                />
              </div>
            </div>
            
            <Button 
              variant="neutral"
              size="sm" 
              onClick={addTimeSlot}
              className="flex items-center w-full justify-center schedule-button"
            >
              <Plus size={14} className="mr-1" /> Lägg till tidslucka
            </Button>
          </div>

          {/* Additional settings */}
          <div className="space-y-4">
            <h3 className="font-medium mb-2 font-monument">Ytterligare inställningar</h3>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm">Tillåt anpassade tidsluckor:</label>
                <Button
                  variant={config.allowCustomTimeSlots ? "default" : "neutral"}
                  size="sm"
                  onClick={() => toggleSetting('allowCustomTimeSlots')}
                  className="schedule-button"
                >
                  {config.allowCustomTimeSlots ? 'Ja' : 'Nej'}
                </Button>
              </div>
              
              <div className="flex items-center justify-between">
                <label className="text-sm">Tillåt variabel längd:</label>
                <Button
                  variant={config.allowVariableDuration ? "default" : "neutral"}
                  size="sm"
                  onClick={() => toggleSetting('allowVariableDuration')}
                  className="schedule-button"
                >
                  {config.allowVariableDuration ? 'Ja' : 'Nej'}
                </Button>
              </div>
              
              <div className="flex items-center justify-between">
                <label className="text-sm">Max antal parallella lådor:</label>
                <Input 
                  type="number"
                  className="w-20 text-right schedule-input"
                  value={config.maxSlotColumns}
                  onChange={(e) => updateMaxSlotColumns(e.target.value)}
                  min="1"
                  max="10"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <label className="text-sm">Höjdmultiplikator:</label>
                <Input 
                  type="number"
                  className="w-20 text-right schedule-input"
                  value={config.slotHeightMultiplier}
                  onChange={(e) => updateHeightMultiplier(e.target.value)}
                  min="0.5"
                  max="2"
                  step="0.1"
                />
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}