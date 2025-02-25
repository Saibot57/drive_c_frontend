'use client';

import React from 'react';
import type { Box } from '../../types';

interface SlotInfoProps {
  box: Box;
  conflicts: number[];
  boxes: Box[];
}

export function SlotInfo({ box, conflicts, boxes }: SlotInfoProps) {
  if (!box) return null;

  return (
    <div className="absolute z-10 bg-white rounded-lg border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-2">
      <div className="font-medium">{box.className}</div>
      <div className="text-sm text-gray-600">{box.teacher}</div>
      {conflicts.length > 0 && (
        <div className="text-[#ff6b6b] text-sm mt-1 font-medium">
          Konflikter med:{' '}
          {conflicts
            .map((id) => boxes.find((b) => b.id === id)?.className)
            .filter(Boolean)
            .join(', ')}
        </div>
      )}
    </div>
  );
}