'use client';

import { useEffect, useRef } from 'react';
import type { TerminalLine, UseTerminalEngine } from '@/hooks/useTerminalEngine';

type Props = Pick<
  UseTerminalEngine,
  'lines' | 'input' | 'setInput' | 'isLoading' | 'submit' | 'historyBack' | 'historyForward'
>;

const LINE_STYLE: Record<string, string> = {
  input:   'text-gray-400',
  success: 'text-emerald-700',
  error:   'text-red-600 font-medium',
  info:    'text-blue-600',
  system:  'text-gray-400 italic',
};

function Line({ line }: { line: TerminalLine }) {
  return (
    <div className={`text-xs font-mono whitespace-pre-wrap leading-relaxed ${LINE_STYLE[line.kind] ?? 'text-gray-700'}`}>
      {line.text}
    </div>
  );
}

export function TerminalPanel({
  lines, input, setInput, isLoading, submit, historyBack, historyForward,
}: Props) {
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = outputRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <div
      className="h-full flex flex-col bg-white overflow-hidden cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      {/* Output history */}
      <div
        ref={outputRef}
        className="flex-1 overflow-auto bg-gray-50 px-4 pt-3 pb-2 space-y-0.5 min-h-0 border-b-2 border-black"
      >
        {lines.length === 0 && (
          <p className="text-xs text-gray-300 font-mono italic">
            Inga kommandon ännu. Prova &quot;help&quot;.
          </p>
        )}
        {lines.map(line => <Line key={line.id} line={line} />)}
        {isLoading && (
          <div className="text-xs text-gray-400 font-mono animate-pulse">…</div>
        )}
      </div>

      {/* Input row */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 bg-white">
        <span className="text-sm font-bold text-black select-none font-mono shrink-0">&gt;_</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter')     { e.preventDefault(); submit(); }
            if (e.key === 'ArrowUp')   { e.preventDefault(); historyBack(); }
            if (e.key === 'ArrowDown') { e.preventDefault(); historyForward(); }
          }}
          disabled={isLoading}
          placeholder='note "Titel"  ·  todo "Text" --week  ·  help'
          className="flex-1 text-sm bg-transparent outline-none placeholder-gray-300 font-mono text-black"
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
        />
      </div>
    </div>
  );
}
