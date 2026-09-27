'use client';

import React from 'react';
import { COURSE_COLOR_PALETTE, MAX_RECENT_CUSTOM_COLORS, RECENT_CUSTOM_COLORS_KEY } from '@/config/plannerConstants';
import { generateBoxColor } from '@/config/colorManagement';
import { SmartTextInput } from '@/components/ui/SmartTextInput';
import { Button } from '@/components/ui/button';
import { ColorPicker } from '@/components/ui/ColorPicker';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ColorTriggerRule, PlannerCourse, RoomTriggerRule } from '@/types/schedule';
import { submitOnCtrlEnter } from '@/utils/dom';
import { ColorTriggerHint, RoomTriggerHint } from './TriggerHints';

type CourseEditorDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: PlannerCourse | null;
  onCourseChange: (course: PlannerCourse) => void;
  /** Satt när användaren valt färg själv. Då räknas färgen inte om ur titeln. */
  manualColor: boolean;
  onManualColorChange: (manual: boolean) => void;
  onSave: (event: React.FormEvent) => void;
  teachers: string[];
  rooms: string[];
  colorTriggers: ColorTriggerRule[];
  roomTriggers: RoomTriggerRule[];
};

/** Skapa eller ändra en byggsten i sidopanelen. */
export function CourseEditorDialog({
  open,
  onOpenChange,
  course,
  onCourseChange,
  manualColor,
  onManualColorChange,
  onSave,
  teachers,
  rooms,
  colorTriggers,
  roomTriggers,
}: CourseEditorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Hantera ämne</DialogTitle></DialogHeader>
        {course && (
          <form onSubmit={onSave} onKeyDown={submitOnCtrlEnter(onSave)} className="space-y-3">
            <Label>Titel</Label>
            <Input value={course.title} onChange={e => {
              const val = e.target.value;
              let col = course.color;
              if (!manualColor && val.length > 1) col = generateBoxColor(val);
              onCourseChange({ ...course, title: val, color: col });
            }} autoFocus />
            <Label>Standardlängd (min)</Label> <Input type="number" value={course.duration} onChange={e => onCourseChange({ ...course, duration: parseInt(e.target.value) })} />
            <div className="grid grid-cols-2 gap-2">
              <SmartTextInput
                fieldId="course-teacher"
                label="Lärare"
                value={course.teacher}
                options={teachers}
                onChange={teacher => onCourseChange({ ...course, teacher })}
              />
              <SmartTextInput
                fieldId="course-room"
                label="Rum"
                value={course.room}
                options={rooms}
                onChange={room => onCourseChange({ ...course, room })}
              />
            </div>
            <RoomTriggerHint title={course.title} room={course.room} roomTriggers={roomTriggers} />
            <ColorTriggerHint title={course.title} colorTriggers={colorTriggers} />
            <ColorPicker
              value={course.color}
              onChange={color => {
                onManualColorChange(true);
                onCourseChange({ ...course, color });
              }}
              palette={COURSE_COLOR_PALETTE}
              recentStorageKey={RECENT_CUSTOM_COLORS_KEY}
              maxRecent={MAX_RECENT_CUSTOM_COLORS}
            />
            <DialogFooter><Button type="submit">Spara</Button></DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
