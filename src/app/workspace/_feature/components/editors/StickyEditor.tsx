'use client';

export interface StickyContent {
  text: string;
  color: string;
}

interface StickyEditorProps {
  content: StickyContent;
  isLocked: boolean;
  onChange: (content: StickyContent) => void;
}

const COLORS = [
  '#fef9c3', // yellow
  '#fce7f3', // pink
  '#dbeafe', // blue
  '#dcfce7', // green
  '#f3e8ff', // purple
  '#ffedd5', // orange
];

export default function StickyEditor({ content, isLocked, onChange }: StickyEditorProps) {
  const text = content?.text ?? '';
  const color = content?.color ?? '#fef9c3';

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: color,
        borderRadius: '0.25rem',
        position: 'relative',
      }}
    >
      <textarea
        value={text}
        onChange={(e) => onChange({ ...content, text: e.target.value })}
        readOnly={isLocked}
        placeholder="Skriv här…"
        style={{
          flex: 1,
          width: '100%',
          resize: 'none',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          padding: '0.25rem',
          fontSize: '0.875rem',
          lineHeight: 1.5,
          color: '#1f2937',
          fontFamily: 'inherit',
        }}
      />

      {!isLocked && (
        <div
          style={{
            display: 'flex',
            gap: '0.375rem',
            padding: '0.375rem 0.25rem',
            justifyContent: 'center',
          }}
        >
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => onChange({ ...content, color: c })}
              style={{
                width: '1rem',
                height: '1rem',
                borderRadius: '50%',
                background: c,
                border: c === color ? '2px solid #6b7280' : '1px solid #d1d5db',
                cursor: 'pointer',
                padding: 0,
                flexShrink: 0,
              }}
              title={c}
            />
          ))}
        </div>
      )}
    </div>
  );
}
