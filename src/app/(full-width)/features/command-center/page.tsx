'use client';

import { useState } from 'react';
import { BookMarked } from 'lucide-react';

import ProtectedRoute         from '@/components/ProtectedRoute';
import { Calendar }           from '@/components/calendar/Calendar';
import { NotesBasket }        from '@/components/command-center/NotesBasket';
import { TerminalPanel }      from '@/components/command-center/TerminalPanel';
import { TodoList }           from '@/components/command-center/TodoList';
import { EditNoteModal }      from '@/components/command-center/EditNoteModal';
import { TemplatesModal }     from '@/components/command-center/TemplatesModal';
import { useTerminalEngine }  from '@/hooks/useTerminalEngine';

export default function CommandCenterPage() {
  const engine = useTerminalEngine();
  const [templatesOpen, setTemplatesOpen] = useState(false);

  return (
    <ProtectedRoute>
      {/* Break out of root layout's pt-8 px-8 to go truly full-bleed */}
      <div className="-mx-8 -mt-8 h-screen flex overflow-hidden bg-gray-100 p-3 gap-3">

        {/* ── Left Column (35%) ─────────────────────────── */}
        <div className="w-[35%] flex flex-col gap-3">

          {/* Notes Basket */}
          <div className="flex-1 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col overflow-hidden min-h-0">
            <div className="h-[3px] bg-green-500 shrink-0" />

            <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0">
              <h2 className="font-bold text-xs uppercase tracking-widest">Notes Basket</h2>
              <button
                onClick={() => setTemplatesOpen(true)}
                className="flex items-center gap-1.5 text-[10px] border-2 border-black px-2 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all font-bold uppercase tracking-wide"
                title="Hantera mallar"
              >
                <BookMarked className="h-3 w-3" />
                Mallar
              </button>
            </div>

            <div className="flex-1 px-4 pb-4 overflow-hidden min-h-0">
              <NotesBasket
                refreshKey={engine.noteRefreshKey}
                onEditRequest={engine.setEditTarget}
              />
            </div>
          </div>

          {/* Command Input */}
          <div className="h-[38%] bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden shrink-0">
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

        {/* ── Right Column (65%) ─────────────────────────── */}
        <div className="flex-1 flex flex-col gap-3">

          {/* Calendar */}
          <div className="flex-1 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col overflow-hidden min-h-0">
            <div className="h-[3px] bg-pink-500 shrink-0" />
            <div className="flex-1 overflow-auto min-h-0">
              <Calendar />
            </div>
          </div>

          {/* Todo List */}
          <div className="h-[35%] bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col overflow-hidden shrink-0">
            <div className="h-[3px] bg-blue-500 shrink-0" />
            <div className="flex flex-col flex-1 overflow-hidden min-h-0 px-4 py-3">
              <h2 className="font-bold text-xs uppercase tracking-widest mb-2 shrink-0">Todo List</h2>
              <div className="flex-1 overflow-hidden min-h-0">
                <TodoList refreshKey={engine.todoRefreshKey} />
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── Modals ─────────────────────────────────────── */}
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
