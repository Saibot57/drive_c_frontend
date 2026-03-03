'use client';

import { useState } from 'react';
import { BookMarked } from 'lucide-react';

import ProtectedRoute            from '@/components/ProtectedRoute';
import { Calendar }              from '@/components/calendar/Calendar';
import { NotesBasket }           from '@/components/command-center/NotesBasket';
import { TerminalPanel }         from '@/components/command-center/TerminalPanel';
import { TodoList }              from '@/components/command-center/TodoList';
import { EditNoteModal }         from '@/components/command-center/EditNoteModal';
import { ViewNoteModal }         from '@/components/command-center/ViewNoteModal';
import { TemplatesModal }        from '@/components/command-center/TemplatesModal';
import { DailySchedulePanel }    from '@/components/command-center/DailySchedulePanel';
import { FeatureNavigation }     from '@/components/FeatureNavigation';
import { useTerminalEngine }     from '@/hooks/useTerminalEngine';
import { StandardDashboardLayout } from '@/components/layout/StandardDashboardLayout';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';

const NEO = 'rounded-xl border-2 border-black bg-white shadow-[4px_4px_0px_rgba(0,0,0,1)] overflow-hidden h-full';

export default function CommandCenterPage() {
  const engine = useTerminalEngine();
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [viewTarget, setViewTarget] = useState<string | null>(null);

  return (
    <ProtectedRoute>
      {/* Break out of root layout's pt-8 px-8 to go truly full-bleed */}
      <div className="-mx-8 -mt-8 min-h-screen bg-gray-100 p-4">
        <StandardDashboardLayout
          mode="resizable"
          defaultRightSize={15}
          rightSidebarWidth="w-[15%]"
          topToolbar={<FeatureNavigation />}
          leftSidebar={
            <div className={NEO}>
              <ResizablePanelGroup direction="vertical">
                {/* ── Anteckningar ── */}
                <ResizablePanel defaultSize={62}>
                  <div className="flex flex-col h-full overflow-hidden">
                    <div className="h-[3px] bg-green-500 shrink-0" />
                    <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0">
                      <h2 className="font-bold text-xs uppercase tracking-widest">Anteckningar</h2>
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
                        onViewRequest={(id) => setViewTarget(id)}
                      />
                    </div>
                  </div>
                </ResizablePanel>

                <ResizableHandle withHandle />

                {/* ── Terminal ── */}
                <ResizablePanel defaultSize={38}>
                  <div className="h-full overflow-hidden">
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
                </ResizablePanel>
              </ResizablePanelGroup>
            </div>
          }
          centerContent={
            <div className={NEO}>
              <ResizablePanelGroup direction="vertical">
                {/* ── Kalender ── */}
                <ResizablePanel defaultSize={65}>
                  <div className="flex flex-col h-full overflow-hidden min-h-0">
                    <div className="h-[3px] bg-pink-500 shrink-0" />
                    <div className="flex-1 overflow-auto min-h-0">
                      <Calendar />
                    </div>
                  </div>
                </ResizablePanel>

                <ResizableHandle withHandle />

                {/* ── Att-göra-lista ── */}
                <ResizablePanel defaultSize={35}>
                  <div className="flex flex-col h-full overflow-hidden min-h-0">
                    <div className="h-[3px] bg-blue-500 shrink-0" />
                    <div className="flex flex-col flex-1 overflow-hidden min-h-0 px-4 py-3">
                      <h2 className="font-bold text-xs uppercase tracking-widest mb-2 shrink-0">Att-göra-lista</h2>
                      <div className="flex-1 overflow-hidden min-h-0">
                        <TodoList refreshKey={engine.todoRefreshKey} />
                      </div>
                    </div>
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            </div>
          }
          rightSidebar={
            <div className={NEO}>
              <div className="flex flex-col h-full overflow-hidden min-h-0">
                <div className="h-[3px] bg-amber-500 shrink-0" />
                <DailySchedulePanel />
              </div>
            </div>
          }
        />
      </div>

      {/* ── Modals ─────────────────────────────────────── */}
      <ViewNoteModal
        noteId={viewTarget}
        onClose={() => setViewTarget(null)}
        onEditRequest={(id) => { setViewTarget(null); engine.setEditTarget(id); }}
      />

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
