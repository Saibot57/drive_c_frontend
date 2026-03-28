'use client';

import { useRef, useState } from 'react';
import { BookMarked, Paintbrush } from 'lucide-react';
import { useCCTheme } from '@/hooks/useCCTheme';
import '@/styles/command-center-theme.css';

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
import { useHotkeys }            from '@/hooks/useHotkeys';
import { StandardDashboardLayout } from '@/components/layout/StandardDashboardLayout';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';

type FocusedPanel = 'notes' | 'terminal' | 'calendar' | 'todos' | 'schedule' | null;

export default function CommandCenterPage() {
  const engine = useTerminalEngine();
  const { theme, toggleTheme } = useCCTheme();
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [viewTarget, setViewTarget] = useState<string | null>(null);
  const [focusedPanel, setFocusedPanel] = useState<FocusedPanel>(null);

  const terminalInputRef = useRef<HTMLInputElement>(null);

  useHotkeys(
    [
      { key: 'N', ctrl: true, shift: true, handler: () => setFocusedPanel('notes') },
      { key: 'T', ctrl: true, shift: true, handler: () => {
        setFocusedPanel('terminal');
        // Also focus the terminal input
        setTimeout(() => terminalInputRef.current?.focus(), 0);
      }},
      { key: 'C', ctrl: true, shift: true, handler: () => setFocusedPanel('calendar') },
      { key: 'D', ctrl: true, shift: true, handler: () => setFocusedPanel('todos') },
      { key: 'S', ctrl: true, shift: true, handler: () => setFocusedPanel('schedule') },
      { key: 'Escape', handler: () => setFocusedPanel(null) },
    ],
    [],
  );

  return (
    <ProtectedRoute>
      {/* Break out of root layout's pt-8 px-8 to go truly full-bleed */}
      <div className="cc-root -mx-8 -mt-8 min-h-screen p-4" data-theme={theme} style={{ background: 'var(--cc-bg-page)' }}>
        <StandardDashboardLayout
          mode="resizable"
          defaultRightSize={15}
          rightSidebarWidth="w-[15%]"
          topToolbar={
            <div className="flex items-center gap-4 w-full">
              <FeatureNavigation />
              <div className="ml-auto">
                <button
                  onClick={toggleTheme}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md transition-colors"
                  style={{ border: 'var(--cc-border-light)', color: 'var(--cc-text-muted)' }}
                  title={`Byt till ${theme === 'neo' ? 'Clean' : 'Neo'}-tema`}
                >
                  <Paintbrush className="h-3.5 w-3.5" />
                  {theme === 'neo' ? 'Clean' : 'Neo'}
                </button>
              </div>
            </div>
          }
          leftSidebar={
            <div className={`cc-card h-full ${focusedPanel === 'notes' || focusedPanel === 'terminal' ? 'cc-ring' : ''}`}>
              <ResizablePanelGroup direction="vertical">
                {/* Notes */}
                <ResizablePanel defaultSize={62}>
                  <div className="flex flex-col h-full overflow-hidden bg-green-50/40">
                    <div className="h-[6px] bg-green-500 shrink-0" />
                    <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0">
                      <h2 className="font-bold text-xs uppercase tracking-widest">Anteckningar</h2>
                      <button
                        onClick={() => setTemplatesOpen(true)}
                        className="cc-card-sm cc-hover-lift flex items-center gap-1.5 text-2xs px-2 py-1 font-bold uppercase tracking-wide transition-all"
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
                        isFocused={focusedPanel === 'notes'}
                      />
                    </div>
                  </div>
                </ResizablePanel>

                <ResizableHandle withHandle />

                {/* Terminal */}
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
                      tabComplete={engine.tabComplete}
                      suggestions={engine.suggestions}
                    />
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            </div>
          }
          centerContent={
            <div className={`cc-card h-full ${focusedPanel === 'calendar' || focusedPanel === 'todos' ? 'cc-ring' : ''}`}>
              <ResizablePanelGroup direction="vertical">
                {/* Calendar */}
                <ResizablePanel defaultSize={65}>
                  <div className="flex flex-col h-full overflow-hidden min-h-0 bg-pink-50/40">
                    <div className="h-[6px] bg-pink-500 shrink-0" />
                    <div className="flex-1 overflow-hidden min-h-0">
                      <Calendar />
                    </div>
                  </div>
                </ResizablePanel>

                <ResizableHandle withHandle />

                {/* Todos */}
                <ResizablePanel defaultSize={35}>
                  <div className="flex flex-col h-full overflow-hidden min-h-0 bg-blue-50/40">
                    <div className="h-[6px] bg-blue-500 shrink-0" />
                    <div className="flex flex-col flex-1 overflow-hidden min-h-0 px-4 py-3">
                      <h2 className="font-bold text-xs uppercase tracking-widest mb-2 shrink-0">Att-göra-lista</h2>
                      <div className="flex-1 overflow-hidden min-h-0">
                        <TodoList
                          refreshKey={engine.todoRefreshKey}
                          isFocused={focusedPanel === 'todos'}
                        />
                      </div>
                    </div>
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            </div>
          }
          rightSidebar={
            <div className={`cc-card h-full ${focusedPanel === 'schedule' ? 'cc-ring' : ''}`}>
              <div className="flex flex-col h-full overflow-hidden min-h-0 bg-amber-50/40">
                <div className="h-[6px] bg-amber-500 shrink-0" />
                <DailySchedulePanel />
              </div>
            </div>
          }
        />
      </div>

      {/* Modals */}
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
