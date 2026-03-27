'use client';

import { useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';

export interface TableContent {
  headers: string[];
  rows: string[][];
  cellColors: Record<string, string>;
  borderColor: string;
}

interface TableEditorProps {
  content: TableContent;
  isLocked: boolean;
  onChange: (content: TableContent) => void;
}

const defaultContent: TableContent = {
  headers: ['Kolumn 1', 'Kolumn 2'],
  rows: [['', '']],
  cellColors: {},
  borderColor: '#e5e7eb',
};

export default function TableEditor({
  content: rawContent,
  isLocked,
  onChange,
}: TableEditorProps) {
  const content: TableContent = rawContent && rawContent.headers ? rawContent : defaultContent;
  const colCount = content.headers.length;

  const updateCell = useCallback(
    (rowIdx: number, colIdx: number, value: string) => {
      const rows = content.rows.map((r) => [...r]);
      rows[rowIdx][colIdx] = value;
      onChange({ ...content, rows });
    },
    [content, onChange],
  );

  const updateHeader = useCallback(
    (colIdx: number, value: string) => {
      const headers = [...content.headers];
      headers[colIdx] = value;
      onChange({ ...content, headers });
    },
    [content, onChange],
  );

  const addRow = useCallback(() => {
    onChange({
      ...content,
      rows: [...content.rows, Array(colCount).fill('')],
    });
  }, [content, colCount, onChange]);

  const addCol = useCallback(() => {
    onChange({
      ...content,
      headers: [...content.headers, `Kolumn ${colCount + 1}`],
      rows: content.rows.map((r) => [...r, '']),
    });
  }, [content, colCount, onChange]);

  const removeRow = useCallback(
    (idx: number) => {
      if (content.rows.length <= 1) return;
      onChange({
        ...content,
        rows: content.rows.filter((_, i) => i !== idx),
      });
    },
    [content, onChange],
  );

  const removeCol = useCallback(
    (idx: number) => {
      if (colCount <= 1) return;
      onChange({
        ...content,
        headers: content.headers.filter((_, i) => i !== idx),
        rows: content.rows.map((r) => r.filter((_, i) => i !== idx)),
      });
    },
    [content, colCount, onChange],
  );

  const borderStyle = `1px solid ${content.borderColor}`;

  return (
    <div style={{ fontSize: '0.8125rem', overflow: 'auto', height: '100%' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          tableLayout: 'fixed',
        }}
      >
        <thead>
          <tr>
            {content.headers.map((h, ci) => (
              <th
                key={ci}
                style={{
                  border: borderStyle,
                  padding: '0.375rem 0.5rem',
                  background: '#f9fafb',
                  fontWeight: 600,
                  textAlign: 'left',
                  position: 'relative',
                }}
              >
                {isLocked ? (
                  h
                ) : (
                  <>
                    <input
                      value={h}
                      onChange={(e) => updateHeader(ci, e.target.value)}
                      style={{
                        width: '100%',
                        border: 'none',
                        background: 'transparent',
                        fontWeight: 600,
                        fontSize: 'inherit',
                        outline: 'none',
                        padding: 0,
                      }}
                    />
                    {colCount > 1 && (
                      <button
                        onClick={() => removeCol(ci)}
                        style={{
                          position: 'absolute',
                          top: 2,
                          right: 2,
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#d1d5db',
                          padding: 0,
                        }}
                        title="Ta bort kolumn"
                      >
                        <Trash2 size={10} />
                      </button>
                    )}
                  </>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {content.rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => {
                const colorKey = `${ri}-${ci}`;
                const bg = content.cellColors[colorKey] || undefined;
                return (
                  <td
                    key={ci}
                    style={{
                      border: borderStyle,
                      padding: '0.375rem 0.5rem',
                      background: bg,
                    }}
                  >
                    {isLocked ? (
                      cell
                    ) : (
                      <input
                        value={cell}
                        onChange={(e) => updateCell(ri, ci, e.target.value)}
                        style={{
                          width: '100%',
                          border: 'none',
                          background: 'transparent',
                          fontSize: 'inherit',
                          outline: 'none',
                          padding: 0,
                        }}
                      />
                    )}
                  </td>
                );
              })}
              {!isLocked && content.rows.length > 1 && (
                <td style={{ border: 'none', padding: '0 0.25rem', verticalAlign: 'middle' }}>
                  <button
                    onClick={() => removeRow(ri)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#d1d5db',
                      padding: 0,
                    }}
                    title="Ta bort rad"
                  >
                    <Trash2 size={12} />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {!isLocked && (
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.375rem' }}>
          <button
            onClick={addRow}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              fontSize: '0.75rem',
              color: '#6b7280',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <Plus size={12} /> Rad
          </button>
          <button
            onClick={addCol}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              fontSize: '0.75rem',
              color: '#6b7280',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <Plus size={12} /> Kolumn
          </button>
        </div>
      )}
    </div>
  );
}
