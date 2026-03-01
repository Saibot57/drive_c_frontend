'use client';

import { useState } from 'react';
import { BookMarked } from 'lucide-react';

import ProtectedRoute                from '@/components/ProtectedRoute';
import { Calendar }                  from '@/components/calendar/Calendar';
import { NotesBasket }               from '@/components/command-center/NotesBasket';
import { TerminalPanel }             from '@/components/command-center/TerminalPanel';
import { TodoList }                  from '@/components/command-center/TodoList';
import { EditNoteModal }             from '@/components/command-center/EditNoteModal';
import { TemplatesModal }            from '@/components/command-center/TemplatesModal';
import { useTerminalEngine }         from '@/hooks/useTerminalEngine';

export default function CommandCenterPage() {
  const engine = useTerminalEngine();
  const [templatesOpen, setTemplatesOpen] = useState(false);

  return (
    <ProtectedRoute>
      {/* Root layout has pt-8 (32px) already applied */}
      <div className="h-[calc(100vh-32px)] flex gap-3 overflow-hidden">

        {/* ── Left Column (35%) ──────────────────────────────── */}
        <div className="w-[35%] flex flex-col gap-3">

          {/* Notes Basket */}
          <div className="flex-1 border-2 border-black bg-[#fef9c3] shadow-[4px_4px_0px_0px_black] p-4 overflow-hidden flex flex-col min-h-0">
            {/* Mallar-knapp */}
            <div className="flex justify-end mb-2 shrink-0">
              <button
                onClick={() => setTemplatesOpen(true)}
                className="flex items-center gap-1.5 text-xs border-2 border-black px-2.5 py-1 bg-white shadow-[2px_2px_0px_0px_black] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all font-bold uppercase tracking-wide"
                title="Hantera mallar"
              >
                <BookMarked className="h-3 w-3" />
                Mallar
              </button>
            </div>
            <NotesBasket
              refreshKey={engine.noteRefreshKey}
              onEditRequest={engine.setEditTarget}
            />
          </div>

          {/* Terminal */}
          <div className="h-[38%] border-2 border-black shadow-[4px_4px_0px_0px_black] overflow-hidden shrink-0">
            <TerminalPanel
              lines={engine.lines}
              input={engine.input}
              setInput={engine.setInput}
              isLoading={engine.isLoading}
              submit={engine.submit}
              historyBack={engine.historyBack}
              historyForward={engine.historyForward}
            />
          </div>

        </div>

        {/* ── Right Column (65%) ─────────────────────────────── */}
        <div className="w-[65%] flex flex-col gap-3">

          {/* Calendar */}
          <div className="flex-1 border-2 border-black bg-white shadow-[4px_4px_0px_0px_black] overflow-auto min-h-0">
            <Calendar />
          </div>

          {/* Todo List */}
          <div className="h-[34%] border-2 border-black bg-[#fce7f3] shadow-[4px_4px_0px_0px_black] p-4 flex flex-col overflow-hidden shrink-0">
            <h2 className="font-bold text-sm uppercase tracking-widest mb-3 shrink-0">
              Todo List
            </h2>
            <div className="flex-1 overflow-hidden min-h-0">
              <TodoList refreshKey={engine.todoRefreshKey} />
            </div>
          </div>

        </div>
      </div>

      {/* ── Modals ─────────────────────────────────────────────── */}
      <EditNoteModal
        noteId={engine.editTarget}
        onClose={engine.clearEditTarget}
        onSaved={() => {
          engine.clearEditTarget();
          engine.refreshNotes();
        }}
      />

      <TemplatesModal
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
      />
    </ProtectedRoute>
  );
}
