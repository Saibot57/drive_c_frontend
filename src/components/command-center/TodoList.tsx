'use client';

import { useEffect, useRef, useState } from 'react';
import { commandCenterService } from '@/services/commandCenterService';
import type { CCTodo } from '@/services/commandCenterService';
import { useHotkeys } from '@/hooks/useHotkeys';

interface Props {
  refreshKey: number;
  isFocused?: boolean;
}

function TodoItem({
  todo,
  onToggle,
  isSelected,
}: {
  todo:       CCTodo;
  onToggle:   (id: string, next: 'open' | 'done') => void;
  isSelected: boolean;
}) {
  const done = todo.status === 'done';
  return (
    <label
      data-todo-item
      className={`flex items-start gap-2 py-1.5 border-b border-gray-100 last:border-0 cursor-pointer group ${done ? 'opacity-50' : ''} ${isSelected ? 'ring-2 ring-black ring-offset-1 rounded' : ''}`}
    >
      <input
        type="checkbox"
        checked={done}
        onChange={() => onToggle(todo.id, done ? 'open' : 'done')}
        className="mt-0.5 shrink-0 cursor-pointer accent-black border-2 border-black"
      />
      <div className="flex-1 min-w-0">
        <p className={`text-xs leading-snug ${done ? 'line-through text-gray-400' : ''}`}>
          {todo.content}
        </p>
        <p className="text-2xs text-gray-300 font-mono mt-0.5">{todo.id.slice(0, 8)}…</p>
      </div>
    </label>
  );
}

function WeekGroup({ week, todos, onToggle, selectedId }: {
  week:       number;
  todos:      CCTodo[];
  onToggle:   (id: string, next: 'open' | 'done') => void;
  selectedId: string | null;
}) {
  return (
    <div className="mb-3">
      <p className="text-2xs font-bold uppercase tracking-widest text-gray-400 mb-1 font-mono">
        v.{week}
      </p>
      {todos.map(t => (
        <TodoItem key={t.id} todo={t} onToggle={onToggle} isSelected={t.id === selectedId} />
      ))}
    </div>
  );
}

export function TodoList({ refreshKey, isFocused = false }: Props) {
  const [todos, setTodos]       = useState<CCTodo[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    commandCenterService.getTodos()
      .then(data  => { if (!cancelled) setTodos(data); })
      .catch(e    => { if (!cancelled) setError(e.message ?? 'Kunde inte hämta todos.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshKey]);

  const handleToggle = async (id: string, next: 'open' | 'done') => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, status: next } : t));
    try {
      await commandCenterService.updateTodo(id, { status: next });
    } catch {
      setTodos(prev => prev.map(t => t.id === id ? { ...t, status: next === 'done' ? 'open' : 'done' } : t));
    }
  };

  // Flat list of all todos for keyboard navigation
  const allTodos = [...todos].sort((a, b) => {
    // week todos first, then date todos
    if (a.type !== b.type) return a.type === 'week' ? -1 : 1;
    if (a.type === 'week') return (a.week_number ?? 0) - (b.week_number ?? 0);
    return (a.target_date ?? '').localeCompare(b.target_date ?? '');
  });

  const selectedTodoId = selectedIndex !== null && allTodos[selectedIndex]
    ? allTodos[selectedIndex].id
    : null;

  // Scroll selected into view
  useEffect(() => {
    if (selectedIndex === null || !containerRef.current) return;
    const items = containerRef.current.querySelectorAll('[data-todo-item]');
    items[selectedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  useHotkeys(
    isFocused
      ? [
          {
            key: 'ArrowDown',
            handler: () => setSelectedIndex(prev =>
              prev === null ? 0 : Math.min(prev + 1, allTodos.length - 1),
            ),
          },
          {
            key: 'j',
            handler: () => setSelectedIndex(prev =>
              prev === null ? 0 : Math.min(prev + 1, allTodos.length - 1),
            ),
          },
          {
            key: 'ArrowUp',
            handler: () => setSelectedIndex(prev =>
              prev === null ? 0 : Math.max((prev ?? 0) - 1, 0),
            ),
          },
          {
            key: 'k',
            handler: () => setSelectedIndex(prev =>
              prev === null ? 0 : Math.max((prev ?? 0) - 1, 0),
            ),
          },
          {
            key: ' ',
            handler: () => {
              if (selectedTodoId) {
                const todo = allTodos.find(t => t.id === selectedTodoId);
                if (todo) handleToggle(todo.id, todo.status === 'done' ? 'open' : 'done');
              }
            },
          },
          {
            key: 'Enter',
            handler: () => {
              if (selectedTodoId) {
                const todo = allTodos.find(t => t.id === selectedTodoId);
                if (todo) handleToggle(todo.id, todo.status === 'done' ? 'open' : 'done');
              }
            },
          },
        ]
      : [],
    [isFocused, selectedIndex, allTodos, selectedTodoId],
  );

  // Split and sort
  const weekTodos = todos
    .filter(t => t.type === 'week')
    .sort((a, b) => (a.week_number ?? 0) - (b.week_number ?? 0));

  const dateTodos = todos
    .filter(t => t.type === 'date')
    .sort((a, b) => (a.target_date ?? '').localeCompare(b.target_date ?? ''));

  const weekGroups = weekTodos.reduce<Record<number, CCTodo[]>>((acc, t) => {
    const w = t.week_number ?? 0;
    (acc[w] ??= []).push(t);
    return acc;
  }, {});

  const dateGroups = dateTodos.reduce<Record<string, CCTodo[]>>((acc, t) => {
    const d = t.target_date ?? '?';
    (acc[d] ??= []).push(t);
    return acc;
  }, {});

  const empty = (
    <p className="text-xs text-gray-400 mt-1">
      Inga todos. Prova: todo &quot;Text&quot; --week
    </p>
  );

  return (
    <div ref={containerRef} className="grid grid-cols-2 gap-3 h-full overflow-hidden">

      {/* Week todos */}
      <div className="border border-black/60 bg-white p-3 flex flex-col overflow-hidden">
        <h3 className="font-bold text-xs uppercase tracking-widest mb-2 shrink-0 pb-2 border-b border-gray-200">
          Denna vecka
        </h3>
        <div className="flex-1 overflow-auto min-h-0">
          {isLoading && <p className="text-xs text-gray-400">Laddar…</p>}
          {error     && <p className="text-xs text-red-500">{error}</p>}
          {!isLoading && !error && weekTodos.length === 0 && empty}
          {!isLoading && Object.entries(weekGroups).map(([week, items]) => (
            <WeekGroup
              key={week}
              week={Number(week)}
              todos={items}
              onToggle={handleToggle}
              selectedId={isFocused ? selectedTodoId : null}
            />
          ))}
        </div>
      </div>

      {/* Date todos */}
      <div className="border border-black/60 bg-white p-3 flex flex-col overflow-hidden">
        <h3 className="font-bold text-xs uppercase tracking-widest mb-2 shrink-0 pb-2 border-b border-gray-200">
          Per datum
        </h3>
        <div className="flex-1 overflow-auto min-h-0">
          {isLoading && <p className="text-xs text-gray-400">Laddar…</p>}
          {error     && <p className="text-xs text-red-500">{error}</p>}
          {!isLoading && !error && dateTodos.length === 0 && (
            <p className="text-xs text-gray-400 mt-1">
              Inga todos. Prova: todo &quot;Text&quot; --date 2025-03-15
            </p>
          )}
          {!isLoading && Object.entries(dateGroups).map(([date, items]) => (
            <div key={date} className="mb-3">
              <p className="text-2xs font-bold uppercase tracking-widest text-gray-400 mb-1 font-mono">
                {date}
              </p>
              {items.map(t => (
                <TodoItem key={t.id} todo={t} onToggle={handleToggle} isSelected={isFocused && t.id === selectedTodoId} />
              ))}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
