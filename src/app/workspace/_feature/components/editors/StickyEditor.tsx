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
    <div className="ws-sticky" style={{ background: color }}>
      <textarea
        className="ws-sticky__text"
        value={text}
        onChange={(e) => onChange({ ...content, text: e.target.value })}
        readOnly={isLocked}
        placeholder="Skriv här…"
      />

      {!isLocked && (
        <div className="ws-sticky__colors">
          {COLORS.map((c) => (
            <button
              key={c}
              className={`ws-sticky__swatch ${c === color ? 'ws-sticky__swatch--active' : ''}`}
              onClick={() => onChange({ ...content, color: c })}
              style={{ background: c }}
              title={c}
            />
          ))}
        </div>
      )}
    </div>
  );
}
