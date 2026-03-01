'use client';

import { useEffect, useRef } from 'react';
import type { TerminalLine, UseTerminalEngine } from '@/hooks/useTerminalEngine';

type Props = Pick<
  UseTerminalEngine,
  'lines' | 'input' | 'setInput' | 'isLoading' | 'submit' | 'historyBack' | 'historyForward'
>;

const LINE_STYLE: Record<string, string> = {
  input:   'text-gray-200',
  success: 'text-green-400',
  error:   'text-red-400',
  info:    'text-sky-300',
  system:  'text-gray-500',
};

function Line({ line }: { line: TerminalLine }) {
  return (
    <div className={`text-xs whitespace-pre-wrap leading-[1.6] ${LINE_STYLE[line.kind] ?? 'text-gray-200'}`}>
      {line.text}
    </div>
  );
}

export function TerminalPanel({
  lines, input, setInput, isLoading, submit, historyBack, historyForward,
}: Props) {
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new output
  useEffect(() => {
    const el = outputRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  // Focus on mount
  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <div
      className="h-full flex flex-col bg-black font-mono overflow-hidden cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      {/* Output */}
      <div
        ref={outputRef}
        className="flex-1 overflow-auto px-3 pt-3 pb-1 space-y-0.5 min-h-0"
      >
        {lines.map(line => <Line key={line.id} line={line} />)}
        {isLoading && (
          <div className="text-xs text-yellow-400 animate-pulse">…</div>
        )}
      </div>

      {/* Input row */}
      <div className="shrink-0 flex items-center gap-2 border-t border-gray-800 px-3 py-2">
        <span className="text-green-400 text-xs select-none">$</span>
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
          placeholder='note "Titel"  |  todo "Text" --week  |  help'
          className="flex-1 bg-transparent text-white text-xs outline-none caret-green-400 placeholder-gray-700"
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
        />
      </div>
    </div>
  );
}
