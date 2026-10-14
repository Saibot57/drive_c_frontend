'use client';

import { useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';

export interface TableContent {
  headers: string[];
  rows: string[][];
  cellColors: Record<string, string>;
  /** Egen ramfärg. Saknas den följer ramen temat. */
  borderColor?: string;
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
};

/**
 * Ramen som skrevs in i varje ny tabell fram till 2026-10. Ingen har kunnat
 * välja den, så den betyder "följ temat" och inte ett val att bevara.
 */
const LEGACY_DEFAULT_BORDER = '#e5e7eb';

/** Ramfärgen användaren valt, eller undefined om ramen ska följa temat. */
const customBorder = (color: string | undefined) => (
  color && color.toLowerCase() !== LEGACY_DEFAULT_BORDER ? color : undefined
);

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

  const border = customBorder(content.borderColor);

  return (
    <div className="ws-table">
      <table
        className="ws-table__grid"
        style={border ? ({ '--ws-table-border': border } as React.CSSProperties) : undefined}
      >
        <thead>
          <tr>
            {content.headers.map((h, ci) => (
              <th key={ci} className="ws-table__cell ws-table__head">
                {isLocked ? (
                  h
                ) : (
                  <>
                    <input
                      value={h}
                      onChange={(e) => updateHeader(ci, e.target.value)}
                      className="ws-editor-bare-input ws-table__input"
                    />
                    {colCount > 1 && (
                      <button
                        onClick={() => removeCol(ci)}
                        className="ws-editor-icon-btn ws-table__remove-col"
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
                  <td key={ci} className="ws-table__cell" style={bg ? { background: bg } : undefined}>
                    {isLocked ? (
                      cell
                    ) : (
                      <input
                        value={cell}
                        onChange={(e) => updateCell(ri, ci, e.target.value)}
                        className="ws-editor-bare-input ws-table__input"
                      />
                    )}
                  </td>
                );
              })}
              {!isLocked && content.rows.length > 1 && (
                <td className="ws-table__row-tools">
                  <button
                    onClick={() => removeRow(ri)}
                    className="ws-editor-icon-btn"
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
        <div className="ws-table__actions">
          <button onClick={addRow} className="ws-editor-add">
            <Plus size={12} /> Rad
          </button>
          <button onClick={addCol} className="ws-editor-add">
            <Plus size={12} /> Kolumn
          </button>
        </div>
      )}
    </div>
  );
}
