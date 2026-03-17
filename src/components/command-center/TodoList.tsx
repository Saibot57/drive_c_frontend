'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { commandCenterService } from '@/services/commandCenterService';
import type { CCTodo } from '@/services/commandCenterService';
import { useHotkeys } from '@/hooks/useHotkeys';
import { isoWeekYear } from '@/utils/dateSv';

interface Props {
  refreshKey: number;
  isFocused?: boolean;
}

// ─── Effective date for sorting ──────────────────────────────────────────────

function getEffectiveDate(todo: CCTodo): Date {
  if (todo.type === 'date' && todo.target_date) {
    return new Date(todo.target_date + 'T00:00:00');
  }
  if (todo.type === 'week' && todo.week_number != null) {
    // Monday of that ISO week (approximate, same year)
    const year = new Date().getFullYear();
    const jan4 = new Date(year, 0, 4);
    const dow = jan4.getDay() || 7;
    const monday = new Date(jan4);
    monday.setDate(jan4.getDate() - dow + 1 + (todo.week_number - 1) * 7);
    return monday;
  }
  return new Date();
}

// ─── Sort: open first → soonest first ────────────────────────────────────────

function sortTodos(list: CCTodo[]): CCTodo[] {
  return [...list].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'open' ? -1 : 1;
    return getEffectiveDate(a).getTime() - getEffectiveDate(b).getTime();
  });
}

// ─── Classify: this-week-or-earlier vs forward ──────────────────────────────

function classifyTodos(todos: CCTodo[]): { thisWeek: CCTodo[]; forward: CCTodo[] } {
  const { week: currentWeek, year: currentYear } = isoWeekYear(new Date());

  const isThisWeekOrEarlier = (todo: CCTodo): boolean => {
    if (todo.type === 'week' && todo.week_number != null) {
      return todo.week_number <= currentWeek;
    }
    if (todo.type === 'date' && todo.target_date) {
      const { week, year } = isoWeekYear(todo.target_date);
      if (year !== currentYear) return year < currentYear;
      return week <= currentWeek;
    }
    return true; // fallback: show in this week
  };

  return {
    thisWeek: sortTodos(todos.filter(isThisWeekOrEarlier)),
    forward: sortTodos(todos.filter(t => !isThisWeekOrEarlier(t))),
  };
}

// ─── Date label for context ─────────────────────────────────────────────────

function getLabel(todo: CCTodo): string {
  if (todo.type === 'date' && todo.target_date) {
    const d = new Date(todo.target_date + 'T00:00:00');
    return d.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' });
  }
  if (todo.type === 'week' && todo.week_number != null) {
    return `v.${todo.week_number}`;
  }
  return '';
}

// ─── Progress indicator ─────────────────────────────────────────────────────

function ColumnProgress({ total, done }: { total: number; done: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="flex items-center gap-2">
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

// ─── Single todo item ───────────────────────────────────────────────────────

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
  const label = getLabel(todo);
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
      <div className="flex-1 min-w-0">
        <p
          className={`text-xs leading-snug ${
            done ? 'line-through text-gray-400' : 'text-gray-800'
          }`}
        >
          {todo.content}
        </p>
        {label && (
          <span className="text-2xs text-gray-400 font-mono">{label}</span>
        )}
      </div>
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

// ─── Main component ─────────────────────────────────────────────────────────

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
      .catch(e    => { if (!cancelled) setError(e.message ?? 'Kunde inte hamta todos.'); })
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

  // ── Classify & sort ─────────────────────────────────────────────────────

  const { thisWeek, forward } = classifyTodos(todos);

  // ── Flat list for keyboard navigation ───────────────────────────────────

  const allTodos = [...thisWeek, ...forward];

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

  const { week: currentWeek } = isoWeekYear(new Date());

  const emptyHint = (text: string) => (
    <p className="text-xs text-gray-300 italic mt-2 text-center">{text}</p>
  );

  const renderColumn = (columnTodos: CCTodo[]) => {
    const done = columnTodos.filter(t => t.status === 'done').length;
    return (
      <>
        <ColumnProgress total={columnTodos.length} done={done} />
        <div className="space-y-1 mt-2">
          {columnTodos.map(t => (
            <TodoItem
              key={t.id}
              todo={t}
              onToggle={handleToggle}
              onDelete={handleDelete}
              isSelected={isFocused && t.id === selectedTodoId}
            />
          ))}
        </div>
      </>
    );
  };

  return (
    <div ref={containerRef} className="grid grid-cols-2 gap-3 h-full overflow-hidden">

      {/* This week (+ overdue) */}
      <div className="border border-black/20 rounded-lg bg-white/60 p-3 flex flex-col overflow-hidden">
        <h3 className="font-bold text-xs uppercase tracking-widest mb-2 shrink-0 pb-2 border-b border-gray-100">
          Denna vecka <span className="font-normal text-gray-400">(v.{currentWeek})</span>
        </h3>
        <div className="flex-1 overflow-auto min-h-0">
          {isLoading && <p className="text-xs text-gray-400">Laddar...</p>}
          {error     && <p className="text-xs text-red-500">{error}</p>}
          {!isLoading && !error && thisWeek.length === 0 && emptyHint('Inga todos denna vecka')}
          {!isLoading && !error && thisWeek.length > 0 && renderColumn(thisWeek)}
        </div>
      </div>

      {/* Forward */}
      <div className="border border-black/20 rounded-lg bg-white/60 p-3 flex flex-col overflow-hidden">
        <h3 className="font-bold text-xs uppercase tracking-widest mb-2 shrink-0 pb-2 border-b border-gray-100">
          Framåt
        </h3>
        <div className="flex-1 overflow-auto min-h-0">
          {isLoading && <p className="text-xs text-gray-400">Laddar...</p>}
          {error     && <p className="text-xs text-red-500">{error}</p>}
          {!isLoading && !error && forward.length === 0 && emptyHint('Inga kommande todos')}
          {!isLoading && !error && forward.length > 0 && renderColumn(forward)}
        </div>
      </div>

    </div>
  );
}
