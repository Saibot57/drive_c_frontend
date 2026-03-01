'use client';

import { useEffect, useState } from 'react';
import { commandCenterService } from '@/services/commandCenterService';
import type { CCTodo } from '@/services/commandCenterService';

interface Props {
  refreshKey: number;
}

function TodoItem({
  todo,
  onToggle,
}: {
  todo:     CCTodo;
  onToggle: (id: string, next: 'open' | 'done') => void;
}) {
  const done = todo.status === 'done';
  return (
    <label className={`flex items-start gap-2 py-1.5 border-b border-gray-100 last:border-0 cursor-pointer group ${done ? 'opacity-50' : ''}`}>
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
        <p className="text-[9px] text-gray-300 font-mono mt-0.5">{todo.id.slice(0, 8)}…</p>
      </div>
    </label>
  );
}

function WeekGroup({ week, todos, onToggle }: {
  week:     number;
  todos:    CCTodo[];
  onToggle: (id: string, next: 'open' | 'done') => void;
}) {
  return (
    <div className="mb-3">
      <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1 font-mono">
        v.{week}
      </p>
      {todos.map(t => <TodoItem key={t.id} todo={t} onToggle={onToggle} />)}
    </div>
  );
}

export function TodoList({ refreshKey }: Props) {
  const [todos, setTodos]       = useState<CCTodo[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError]       = useState<string | null>(null);

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
    // Optimistic update
    setTodos(prev => prev.map(t => t.id === id ? { ...t, status: next } : t));
    try {
      await commandCenterService.updateTodo(id, { status: next });
    } catch {
      // Revert
      setTodos(prev => prev.map(t => t.id === id ? { ...t, status: next === 'done' ? 'open' : 'done' } : t));
    }
  };

  // Split and sort
  const weekTodos = todos
    .filter(t => t.type === 'week')
    .sort((a, b) => (a.week_number ?? 0) - (b.week_number ?? 0));

  const dateTodos = todos
    .filter(t => t.type === 'date')
    .sort((a, b) => (a.target_date ?? '').localeCompare(b.target_date ?? ''));

  // Group week todos by week number
  const weekGroups = weekTodos.reduce<Record<number, CCTodo[]>>((acc, t) => {
    const w = t.week_number ?? 0;
    (acc[w] ??= []).push(t);
    return acc;
  }, {});

  // Group date todos by date
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
    <div className="grid grid-cols-2 gap-3 h-full overflow-hidden">

      {/* ── This Week ── */}
      <div className="border-2 border-black bg-white p-3 flex flex-col overflow-hidden">
        <h3 className="font-bold text-xs uppercase tracking-widest mb-2 shrink-0 pb-2 border-b-2 border-black">
          This Week
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
            />
          ))}
        </div>
      </div>

      {/* ── By Date ── */}
      <div className="border-2 border-black bg-white p-3 flex flex-col overflow-hidden">
        <h3 className="font-bold text-xs uppercase tracking-widest mb-2 shrink-0 pb-2 border-b-2 border-black">
          By Date
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
              <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1 font-mono">
                {date}
              </p>
              {items.map(t => <TodoItem key={t.id} todo={t} onToggle={handleToggle} />)}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
