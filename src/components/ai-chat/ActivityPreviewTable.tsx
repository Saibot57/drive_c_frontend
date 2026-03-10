import React from 'react';

import type { ActivityImportItem } from '@/types/schedule';

interface ActivityPreviewTableProps {
  activities: ActivityImportItem[];
}

export function ActivityPreviewTable({ activities }: ActivityPreviewTableProps) {
  if (!activities.length) return null;

  return (
    <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: '4px 6px' }}>Namn</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: '4px 6px' }}>Tid</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: '4px 6px' }}>Dag(ar)</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: '4px 6px' }}>Vecka</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: '4px 6px' }}>Deltagare</th>
          </tr>
        </thead>
        <tbody>
          {activities.map((a, i) => (
            <tr key={i}>
              <td style={{ padding: '4px 6px', borderBottom: '1px solid #eee' }}>
                {a.icon ? `${a.icon} ` : ''}{a.name}
              </td>
              <td style={{ padding: '4px 6px', borderBottom: '1px solid #eee' }}>
                {a.startTime}–{a.endTime}
              </td>
              <td style={{ padding: '4px 6px', borderBottom: '1px solid #eee' }}>
                {a.days.join(', ')}
              </td>
              <td style={{ padding: '4px 6px', borderBottom: '1px solid #eee' }}>
                v{a.week}
              </td>
              <td style={{ padding: '4px 6px', borderBottom: '1px solid #eee' }}>
                {a.participants.join(', ')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
