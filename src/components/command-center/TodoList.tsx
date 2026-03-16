'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { commandCenterService } from '@/services/commandCenterService';
import type { CCTodo } from '@/services/commandCenterService';
import { useHotkeys } from '@/hooks/useHotkeys';

interface Props {
  refreshKey: number;
  isFocused?: boolean;
}

// ─── Progress indicator per group ────────────────────────────────────────────

function GroupProgress({ total, done }: { total: number; done: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-2xs text-gray-400 font-mono tabular-nums shrink-0">
        {done}/{total}
      </span>
    </div>
  );
}

// ─── Single todo item ────────────────────────────────────────────────────────

function TodoItem({
  todo,
  onToggle,
  onDelete,
  isSelected,
}: {
  todo:       CCTodo;
  onToggle:   (id: string, next: 'open' | 'done') => void;
  onDelete:   (id: string) => void;
  isSelected: boolean;
}) {
  const done = todo.status === 'done';
  return (
    <div
      data-todo-item
      className={`
        group flex items-center gap-2.5 px-2.5 py-2 rounded-md transition-all
        ${done
          ? 'bg-gray-50 opacity-60'
          : 'bg-white border-l-2 border-blue-500'
        }
        ${isSelected ? 'ring-2 ring-black ring-offset-1' : ''}
      `}
    >
      <input
        type="checkbox"
        checked={done}
        onChange={() => onToggle(todo.id, done ? 'open' : 'done')}
        className="mt-0.5 shrink-0 cursor-pointer accent-emerald-600 h-3.5 w-3.5"
      />
      <p
        className={`flex-1 min-w-0 text-xs leading-snug ${
          done ? 'line-through text-gray-400' : 'text-gray-800'
        }`}
      >
        {todo.content}
      </p>
      <button
        onClick={() => onDelete(todo.id)}
        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-opacity shrink-0 p-0.5"
        title="Ta bort"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

// ─── Week group with progress ────────────────────────────────────────────────

function WeekGroup({ week, todos, onToggle, onDelete, selectedId }: {
  week:       number;
  todos:      CCTodo[];
  onToggle:   (id: string, next: 'open' | 'done') => void;
  onDelete:   (id: string) => void;
  selectedId: string | null;
}) {
  const sorted = sortOpenFirst(todos);
  const doneCount = todos.filter(t => t.status === 'done').length;
  return (
    <div className="mb-4">
      <div className="mb-1.5">
        <p className="text-2xs font-bold uppercase tracking-widest text-gray-400 font-mono">
          v.{week}
        </p>
        <GroupProgress total={todos.length} done={doneCount} />
      </div>
      <div className="space-y-1">
        {sorted.map(t => (
          <TodoItem key={t.id} todo={t} onToggle={onToggle} onDelete={onDelete} isSelected={t.id === selectedId} />
        ))}
      </div>
    </div>
  );
}

// ─── Date group with progress ────────────────────────────────────────────────

function DateGroup({ date, todos, onToggle, onDelete, selectedId }: {
  date:       string;
  todos:      CCTodo[];
  onToggle:   (id: string, next: 'open' | 'done') => void;
  onDelete:   (id: string) => void;
  selectedId: string | null;
}) {
  const sorted = sortOpenFirst(todos);
  const doneCount = todos.filter(t => t.status === 'done').length;
  return (
    <div className="mb-4">
      <div className="mb-1.5">
        <p className="text-2xs font-bold uppercase tracking-widest text-gray-400 font-mono">
          {date}
        </p>
        <GroupProgress total={todos.length} done={doneCount} />
      </div>
      <div className="space-y-1">
        {sorted.map(t => (
          <TodoItem key={t.id} todo={t} onToggle={onToggle} onDelete={onDelete} isSelected={selectedId === t.id} />
        ))}
      </div>
    </div>
  );
}

// ─── Sort helper: open items first ───────────────────────────────────────────

function sortOpenFirst(todos: CCTodo[]): CCTodo[] {
  return [...todos].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'open' ? -1 : 1;
    return 0;
  });
}

// ─── Main component ──────────────────────────────────────────────────────────

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

  // ── Toggle status (optimistic) ──────────────────────────────────────────

  const handleToggle = async (id: string, next: 'open' | 'done') => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, status: next } : t));
    try {
      await commandCenterService.updateTodo(id, { status: next });
    } catch {
      setTodos(prev => prev.map(t => t.id === id ? { ...t, status: next === 'done' ? 'open' : 'done' } : t));
    }
  };

  // ── Delete (optimistic) ─────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    const prev = todos;
    setTodos(t => t.filter(x => x.id !== id));
    try {
      await commandCenterService.deleteTodo(id);
    } catch {
      setTodos(prev);
    }
  };

  // ── Flat list for keyboard navigation ───────────────────────────────────

  const allTodos = [...todos].sort((a, b) => {
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

  // ── Split & group ──────────────────────────────────────────────────────

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

  const emptyHint = (text: string) => (
    <p className="text-xs text-gray-300 italic mt-2 text-center">{text}</p>
  );

  return (
    <div ref={containerRef} className="grid grid-cols-2 gap-3 h-full overflow-hidden">

      {/* Week todos */}
      <div className="border border-black/20 rounded-lg bg-white/60 p-3 flex flex-col overflow-hidden">
        <h3 className="font-bold text-xs uppercase tracking-widest mb-2 shrink-0 pb-2 border-b border-gray-100">
          Denna vecka
        </h3>
        <div className="flex-1 overflow-auto min-h-0">
          {isLoading && <p className="text-xs text-gray-400">Laddar…</p>}
          {error     && <p className="text-xs text-red-500">{error}</p>}
          {!isLoading && !error && weekTodos.length === 0 && emptyHint('t "Text" --week')}
          {!isLoading && Object.entries(weekGroups).map(([week, items]) => (
            <WeekGroup
              key={week}
              week={Number(week)}
              todos={items}
              onToggle={handleToggle}
              onDelete={handleDelete}
              selectedId={isFocused ? selectedTodoId : null}
            />
          ))}
        </div>
      </div>

      {/* Date todos */}
      <div className="border border-black/20 rounded-lg bg-white/60 p-3 flex flex-col overflow-hidden">
        <h3 className="font-bold text-xs uppercase tracking-widest mb-2 shrink-0 pb-2 border-b border-gray-100">
          Per datum
        </h3>
        <div className="flex-1 overflow-auto min-h-0">
          {isLoading && <p className="text-xs text-gray-400">Laddar…</p>}
          {error     && <p className="text-xs text-red-500">{error}</p>}
          {!isLoading && !error && dateTodos.length === 0 && emptyHint('t "Text" --date idag')}
          {!isLoading && Object.entries(dateGroups).map(([date, items]) => (
            <DateGroup
              key={date}
              date={date}
              todos={items}
              onToggle={handleToggle}
              onDelete={handleDelete}
              selectedId={isFocused ? selectedTodoId : null}
            />
          ))}
        </div>
      </div>

    </div>
  );
}
