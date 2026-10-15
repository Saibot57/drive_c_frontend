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
    <div className="ws-list">
      <div className="ws-list__items">
        {content.items.map((item) => {
          const textClass = `ws-list__text${item.done ? ' ws-list__text--done' : ''}`;
          return (
            <div key={item.id} className="ws-list__item">
              {!isLocked && <GripVertical size={12} className="ws-list__grip" />}
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => toggleDone(item.id)}
                disabled={isLocked}
                className="ws-list__check"
              />
              {isLocked ? (
                <span className={textClass}>{item.text || '\u00A0'}</span>
              ) : (
                <input
                  value={item.text}
                  onChange={(e) => updateText(item.id, e.target.value)}
                  placeholder="Skriv här..."
                  className={`ws-editor-bare-input ${textClass}`}
                />
              )}
              {!isLocked && content.items.length > 1 && (
                <button
                  onClick={() => removeItem(item.id)}
                  className="ws-editor-icon-btn ws-list__remove"
                  title="Ta bort"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {!isLocked && (
        <button onClick={addItem} className="ws-editor-add ws-list__add">
          <Plus size={12} /> Lägg till
        </button>
      )}
    </div>
  );
}
