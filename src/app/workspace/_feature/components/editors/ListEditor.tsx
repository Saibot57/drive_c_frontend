'use client';

import { useCallback } from 'react';
import { Plus, X, GripVertical } from 'lucide-react';

export interface ListItem {
  id: string;
  text: string;
  done: boolean;
}

export interface ListContent {
  items: ListItem[];
}

interface ListEditorProps {
  content: ListContent;
  isLocked: boolean;
  onChange: (content: ListContent) => void;
}

const defaultContent: ListContent = {
  items: [{ id: '1', text: '', done: false }],
};

export default function ListEditor({
  content: rawContent,
  isLocked,
  onChange,
}: ListEditorProps) {
  const content: ListContent = rawContent && rawContent.items ? rawContent : defaultContent;

  const toggleDone = useCallback(
    (id: string) => {
      onChange({
        items: content.items.map((item) =>
          item.id === id ? { ...item, done: !item.done } : item,
        ),
      });
    },
    [content, onChange],
  );

  const updateText = useCallback(
    (id: string, text: string) => {
      onChange({
        items: content.items.map((item) =>
          item.id === id ? { ...item, text } : item,
        ),
      });
    },
    [content, onChange],
  );

  const addItem = useCallback(() => {
    onChange({
      items: [
        ...content.items,
        { id: String(Date.now()), text: '', done: false },
      ],
    });
  }, [content, onChange]);

  const removeItem = useCallback(
    (id: string) => {
      if (content.items.length <= 1) return;
      onChange({ items: content.items.filter((item) => item.id !== id) });
    },
    [content, onChange],
  );

  return (
    <div style={{ fontSize: '0.8125rem', height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
        {content.items.map((item) => (
          <div
            key={item.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.25rem 0',
              borderRadius: '0.25rem',
            }}
          >
            {!isLocked && (
              <GripVertical
                size={12}
                style={{ color: '#d1d5db', flexShrink: 0, cursor: 'grab' }}
              />
            )}
            <input
              type="checkbox"
              checked={item.done}
              onChange={() => toggleDone(item.id)}
              disabled={isLocked}
              style={{
                width: '0.875rem',
                height: '0.875rem',
                cursor: isLocked ? 'default' : 'pointer',
                accentColor: '#3b82f6',
                flexShrink: 0,
              }}
            />
            {isLocked ? (
              <span
                style={{
                  flex: 1,
                  textDecoration: item.done ? 'line-through' : 'none',
                  color: item.done ? '#9ca3af' : '#374151',
                }}
              >
                {item.text || '\u00A0'}
              </span>
            ) : (
              <input
                value={item.text}
                onChange={(e) => updateText(item.id, e.target.value)}
                placeholder="Skriv här..."
                style={{
                  flex: 1,
                  border: 'none',
                  background: 'transparent',
                  fontSize: 'inherit',
                  outline: 'none',
                  padding: 0,
                  textDecoration: item.done ? 'line-through' : 'none',
                  color: item.done ? '#9ca3af' : '#374151',
                }}
              />
            )}
            {!isLocked && content.items.length > 1 && (
              <button
                onClick={() => removeItem(item.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#d1d5db',
                  padding: 0,
                  display: 'flex',
                  opacity: 0.5,
                }}
                title="Ta bort"
              >
                <X size={12} />
              </button>
            )}
          </div>
        ))}
      </div>

      {!isLocked && (
        <button
          onClick={addItem}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            fontSize: '0.75rem',
            color: '#6b7280',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            marginTop: '0.375rem',
          }}
        >
          <Plus size={12} /> Lägg till
        </button>
      )}
    </div>
  );
}
