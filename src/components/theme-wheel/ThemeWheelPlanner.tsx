'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Cloud, CloudOff, Download, FileJson, Image as ImageIcon, Loader2, Palette,
  Plus, Printer, Settings, Undo2, Upload,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { FeatureNavigation } from '@/components/FeatureNavigation';
import { ThemeArea, ThemeBlock, ThemeWheel as ThemeWheelData } from '@/types/themeWheel';
import { buildRingLayout, childrenOf, freeWeeksInParent, weeksPerArea } from '@/utils/themeWheelLayout';
import { buildWheelMetrics } from '@/utils/themeWheelGeometry';
import { buildWheelWeeks } from '@/utils/themeWheelWeeks';
import {
  buildAreaKey,
  deriveAreasFromBlocks,
  isDerivedArea,
  mergeAreas,
} from '@/utils/themeWheelAreas';
import { generateBoxColor } from '@/config/colorManagement';
import { deriveChildColor } from '@/utils/readableTextColor';
import { useThemeWheelHistory } from '@/hooks/useThemeWheelHistory';
import { useThemeWheelSync } from '@/hooks/useThemeWheelSync';
import { parseWheelFile, useThemeWheelExport } from '@/hooks/useThemeWheelExport';
import { useWheelInteraction } from '@/hooks/useWheelInteraction';
import { usePlannerNotice } from '@/hooks/usePlannerNotice';
import { useHotkeys } from '@/hooks/useHotkeys';
import { ThemeWheel } from '@/components/theme-wheel/ThemeWheel';
import { AreaLibraryCard } from '@/components/theme-wheel/AreaLibraryCard';
import { ThemeWheelModals } from '@/components/theme-wheel/ThemeWheelModals';
import { ThemeWheelArchive } from '@/components/theme-wheel/ThemeWheelArchive';
import { DEFAULT_AREA_COLOR, EMPTY_WHEEL } from '@/components/theme-wheel/constants';
import '@/styles/schedule-theme.css';
import '@/styles/theme-wheel.css';

type ContextMenuState =
  | { kind: 'block'; x: number; y: number; block: ThemeBlock }
  | { kind: 'week'; x: number; y: number; week: number };

export default function ThemeWheelPlanner() {
  const { plannerNotice, showNotice } = usePlannerNotice();
  const { wheel, commit, undo } = useThemeWheelHistory(EMPTY_WHEEL);
  const svgRef = useRef<SVGSVGElement>(null);

  const [manualAreas, setManualAreas] = useState<ThemeArea[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [editingArea, setEditingArea] = useState<ThemeArea | null>(null);
  const [editingBlock, setEditingBlock] = useState<ThemeBlock | null>(null);
  const [editingSettings, setEditingSettings] = useState<ThemeWheelData | null>(null);
  const [deleteAreaId, setDeleteAreaId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [manualColor, setManualColor] = useState(false);

  const [isArchiveCollapsed, setIsArchiveCollapsed] = useState(false);

  const {
    wheels,
    loadStatus,
    saveStatus,
    isBusy,
    selectWheel,
    createWheel,
    importWheel,
    duplicateWheel,
    deleteWheel,
    shareWheel,
  } = useThemeWheelSync({ wheel, commit, manualAreas, setManualAreas, showNotice });

  const { exportImage, exportPdf, printVector, exportJson } = useThemeWheelExport({
    wheel, svgRef, showNotice,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  useEffect(() => {
    if (!isExportMenuOpen) return;
    const close = (event: MouseEvent) => {
      if (!exportMenuRef.current?.contains(event.target as Node)) setIsExportMenuOpen(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [isExportMenuOpen]);

  const handleImportFile = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        void importWheel(parseWheelFile(String(reader.result)));
      } catch (error) {
        showNotice(error instanceof Error ? error.message : 'Kunde inte läsa filen.', 'error');
      }
    };
    reader.onerror = () => showNotice('Kunde inte läsa filen.', 'error');
    reader.readAsText(file);
  }, [importWheel, showNotice]);

  // --- Härledd data ---

  const weeks = useMemo(
    () => buildWheelWeeks(wheel.startWeek, wheel.startYear, wheel.weekCount),
    [wheel.startWeek, wheel.startYear, wheel.weekCount]
  );

  // Samma beräkning som ThemeWheel gör internt. Pekarlagret behöver måtten för
  // att kunna räkna om en skärmposition till vecka och ring, och släpplogiken
  // behöver placeringarna för att veta vad man släppte ovanpå.
  const layout = useMemo(
    () => buildRingLayout(wheel.blocks, wheel.weekCount),
    [wheel.blocks, wheel.weekCount]
  );
  const metrics = useMemo(
    () => buildWheelMetrics(layout.ringCount, layout.ringsWithChildren),
    [layout]
  );

  /** Arbetsområdet som ligger i en viss ring och vecka, om något gör det. */
  const hostAt = useCallback((ring: number, week: number) => (
    wheel.blocks.find(block => {
      const placement = layout.placementByBlock.get(block.instanceId);
      return placement
        && placement.lane !== 'child'
        && placement.ring === ring
        && week >= placement.startWeek
        && week <= placement.endWeek;
    }) ?? null
  ), [layout, wheel.blocks]);

  const areas = useMemo(
    () => mergeAreas(manualAreas, deriveAreasFromBlocks(wheel.blocks)),
    [manualAreas, wheel.blocks]
  );

  const weeksByArea = useMemo(() => {
    const totals = new Map<string, number>();
    weeksPerArea(wheel.blocks, wheel.weekCount, wheel.holidayWeeks).forEach(([title, count]) => {
      totals.set(buildAreaKey(title), count);
    });
    return totals;
  }, [wheel.blocks, wheel.holidayWeeks, wheel.weekCount]);

  // --- Skapa och ändra block ---

  const handleCreateBlock = useCallback((
    area: ThemeArea,
    target: { startWeek: number; endWeek: number; ring: number }
  ) => {
    const instanceId = uuidv4();
    // Släpps området ovanpå ett befintligt arbetsområde blir det ett delområde
    // i stället för att tryckas ut i en ny ring. Det är hela poängen: hjulet
    // ska inte växa bara för att något ska rymmas inuti något annat.
    const host = hostAt(target.ring, target.startWeek);

    if (host) {
      if (!freeWeeksInParent(wheel.blocks, host).includes(target.startWeek)) {
        showNotice('Veckan har redan ett delområde.', 'warning');
        return;
      }
      const siblings = childrenOf(wheel.blocks, host.instanceId).length;
      commit(prev => ({
        ...prev,
        blocks: [...prev.blocks, {
          instanceId,
          parentId: host.instanceId,
          areaId: isDerivedArea(area) ? undefined : area.id,
          title: area.title,
          color: deriveChildColor(host.color, siblings),
          comment: area.comment,
          startWeek: target.startWeek,
          endWeek: target.startWeek,
        }],
      }));
      setSelectedInstanceId(instanceId);
      return;
    }

    commit(prev => ({
      ...prev,
      blocks: [...prev.blocks, {
        instanceId,
        areaId: isDerivedArea(area) ? undefined : area.id,
        title: area.title,
        color: area.color,
        comment: area.comment,
        startWeek: target.startWeek,
        endWeek: target.endWeek,
        ring: target.ring,
      }],
    }));
    setSelectedInstanceId(instanceId);
  }, [commit, hostAt, showNotice, wheel.blocks]);

  const handleUpdateBlock = useCallback((instanceId: string, patch: Partial<ThemeBlock>) => {
    commit(prev => {
      const current = prev.blocks.find(block => block.instanceId === instanceId);
      if (!current) return prev;
      const unchanged = Object.entries(patch)
        .every(([key, value]) => current[key as keyof ThemeBlock] === value);
      if (unchanged) return prev;

      const next = { ...current, ...patch };

      // Ett delområde hålls inom sin förälder, ärver dess ring och får inte
      // lägga sig över ett syskon. Krockar det avbryts ändringen helt hellre
      // än att två delområden ritas ovanpå varandra.
      if (next.parentId) {
        const parent = prev.blocks.find(block => block.instanceId === next.parentId);
        if (parent) {
          const clamp = (week: number) => (
            Math.min(Math.max(week, parent.startWeek), parent.endWeek)
          );
          next.startWeek = clamp(next.startWeek);
          next.endWeek = clamp(next.endWeek);
          next.ring = undefined;

          const taken = new Set<number>();
          prev.blocks
            .filter(block => block.parentId === parent.instanceId && block.instanceId !== instanceId)
            .forEach(sibling => {
              for (let week = sibling.startWeek; week <= sibling.endWeek; week++) taken.add(week);
            });
          for (let week = next.startWeek; week <= next.endWeek; week++) {
            if (taken.has(week)) return prev;
          }
        }
      }

      // Milstolpen hör ihop med sitt block. Flyttas blocket följer den med lika
      // långt; krymps blocket dras den in till närmaste ände i stället.
      if (next.milestone) {
        const shift = next.startWeek - current.startWeek;
        const moved = next.milestone.week + shift;
        next.milestone = {
          ...next.milestone,
          week: Math.min(Math.max(moved, next.startWeek), next.endWeek),
        };
      }

      // Flyttas ett arbetsområde följer dess delområden med lika långt, och
      // krymps det dras de in innanför den nya kanten.
      const shift = next.startWeek - current.startWeek;
      const spanMoved = shift !== 0 || next.endWeek !== current.endWeek;

      return {
        ...prev,
        blocks: prev.blocks.map(block => {
          if (block.instanceId === instanceId) return next;
          if (block.parentId !== instanceId || !spanMoved) return block;
          const clamp = (week: number) => Math.min(Math.max(week, next.startWeek), next.endWeek);
          const start = clamp(block.startWeek + shift);
          const end = clamp(block.endWeek + shift);
          return { ...block, startWeek: Math.min(start, end), endWeek: Math.max(start, end) };
        }),
      };
    });
  }, [commit]);

  const handleRemoveBlock = useCallback((instanceId: string) => {
    // Delområdena hör till sitt arbetsområde och följer med när det tas bort.
    commit(prev => ({
      ...prev,
      blocks: prev.blocks.filter(block => (
        block.instanceId !== instanceId && block.parentId !== instanceId
      )),
    }));
    setSelectedInstanceId(current => (current === instanceId ? null : current));
    setContextMenu(null);
  }, [commit]);

  const { preview, startCreate, startMove, startResize } = useWheelInteraction({
    svgRef,
    metrics,
    weekCount: wheel.weekCount,
    onCreate: handleCreateBlock,
    onUpdate: handleUpdateBlock,
  });

  const openNewBlockEditor = useCallback((week: number, ring?: number, parentId?: string) => {
    const parent = parentId
      ? wheel.blocks.find(block => block.instanceId === parentId) ?? null
      : null;
    // Ett delområde ärver en nyans av sitt arbetsområde, så titeln ska inte
    // skriva över den medan man skriver.
    setManualColor(Boolean(parent));
    setEditingBlock({
      instanceId: uuidv4(),
      title: '',
      color: parent
        ? deriveChildColor(parent.color, childrenOf(wheel.blocks, parent.instanceId).length)
        : DEFAULT_AREA_COLOR,
      startWeek: week,
      endWeek: week,
      ring: parent ? undefined : ring,
      parentId: parent?.instanceId,
    });
  }, [wheel.blocks]);

  const addChildTo = useCallback((parent: ThemeBlock) => {
    const free = freeWeeksInParent(wheel.blocks, parent);
    setContextMenu(null);
    if (free.length === 0) {
      showNotice('Arbetsområdet har redan delområden i alla sina veckor.', 'warning');
      return;
    }
    openNewBlockEditor(free[0], undefined, parent.instanceId);
  }, [openNewBlockEditor, showNotice, wheel.blocks]);

  const handleSaveBlock = useCallback((event: React.FormEvent) => {
    event.preventDefault();
    if (!editingBlock || !editingBlock.title.trim()) return;
    const saved = { ...editingBlock, title: editingBlock.title.trim() };
    commit(prev => {
      const exists = prev.blocks.some(block => block.instanceId === saved.instanceId);
      return {
        ...prev,
        blocks: exists
          ? prev.blocks.map(block => (block.instanceId === saved.instanceId ? saved : block))
          : [...prev.blocks, saved],
      };
    });
    setSelectedInstanceId(saved.instanceId);
    setEditingBlock(null);
  }, [commit, editingBlock]);

  const handleDuplicateBlock = useCallback((block: ThemeBlock) => {
    const instanceId = uuidv4();
    commit(prev => ({
      ...prev,
      blocks: [...prev.blocks, { ...block, instanceId, ring: undefined }],
    }));
    setSelectedInstanceId(instanceId);
    setContextMenu(null);
    showNotice('Arbetsområde duplicerat', 'success');
  }, [commit, showNotice]);

  // --- Bibliotek ---

  const handleSaveArea = useCallback((event: React.FormEvent) => {
    event.preventDefault();
    if (!editingArea || !editingArea.title.trim()) return;
    const saved = { ...editingArea, title: editingArea.title.trim() };
    // Ett härlett område finns bara som en spegling av hjulet. Sparas det får
    // det ett eget id och blir en riktig byggsten, precis som i planeraren.
    const manualId = isDerivedArea(saved) ? uuidv4() : saved.id;
    const nextArea = { ...saved, id: manualId };
    setManualAreas(prev => (
      prev.some(area => area.id === manualId)
        ? prev.map(area => (area.id === manualId ? nextArea : area))
        : [...prev, nextArea]
    ));
    setEditingArea(null);
  }, [editingArea]);

  const handleDeleteArea = useCallback((area: ThemeArea, derived: boolean) => {
    if (derived) {
      showNotice('Området ligger i hjulet. Ta bort bågarna först.', 'warning');
      return;
    }
    setDeleteAreaId(area.id);
  }, [showNotice]);

  const deleteAreaName = useMemo(
    () => manualAreas.find(area => area.id === deleteAreaId)?.title ?? null,
    [deleteAreaId, manualAreas]
  );

  // --- Lovveckor och inställningar ---

  const toggleHolidayWeek = useCallback((week: number) => {
    commit(prev => ({
      ...prev,
      holidayWeeks: prev.holidayWeeks.includes(week)
        ? prev.holidayWeeks.filter(index => index !== week)
        : [...prev.holidayWeeks, week].sort((a, b) => a - b),
    }));
    setContextMenu(null);
  }, [commit]);

  const handleSaveSettings = useCallback((event: React.FormEvent) => {
    event.preventDefault();
    if (!editingSettings || !editingSettings.name.trim()) return;
    const next = editingSettings;
    commit(prev => ({
      ...prev,
      name: next.name.trim(),
      startWeek: next.startWeek,
      startYear: next.startYear,
      weekCount: next.weekCount,
      // Lovmarkeringar utanför det nya spannet skulle annars ligga kvar osynliga.
      holidayWeeks: prev.holidayWeeks.filter(week => week < next.weekCount),
    }));
    setEditingSettings(null);
  }, [commit, editingSettings]);

  // --- Tangentbord ---

  // En öppen dialog äger tangentbordet; annars skulle Backspace kunna radera
  // blocket bakom rutan medan man fyller i formuläret.
  const isDialogOpen = Boolean(editingArea || editingBlock || editingSettings || deleteAreaId);

  const removeSelected = useCallback(() => {
    if (isDialogOpen || !selectedInstanceId) return;
    handleRemoveBlock(selectedInstanceId);
  }, [handleRemoveBlock, isDialogOpen, selectedInstanceId]);

  useHotkeys(
    [
      { key: 'Delete', handler: removeSelected },
      { key: 'Backspace', handler: removeSelected },
      {
        key: 'Escape',
        handler: () => { setSelectedInstanceId(null); setContextMenu(null); },
      },
    ],
    [removeSelected],
  );

  useEffect(() => {
    if (!contextMenu) return;
    const dismiss = () => setContextMenu(null);
    window.addEventListener('click', dismiss);
    return () => window.removeEventListener('click', dismiss);
  }, [contextMenu]);

  // --- Render ---

  return (
    <div className="sp-root">
      <div className="fixed inset-0 z-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/bakgrund59.png" alt="" className="h-full w-full object-cover" />
      </div>

      <div className="relative z-10 pb-20">
        <div className="sp-toolbar mb-6 flex flex-col items-start gap-6 p-4 lg:flex-row lg:items-center">
          <FeatureNavigation />

          <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
            <span
              className="flex items-center gap-1.5 text-xs font-semibold text-gray-500"
              title={saveStatus === 'error' ? 'Ändringarna nådde inte molnet' : 'Sparas automatiskt'}
            >
              {saveStatus === 'saving' && <Loader2 size={14} className="animate-spin" />}
              {saveStatus === 'error' && <CloudOff size={14} className="text-rose-600" />}
              {saveStatus !== 'saving' && saveStatus !== 'error' && <Cloud size={14} />}
              {saveStatus === 'saving' ? 'Sparar…' : saveStatus === 'error' ? 'Ej sparat' : 'Sparat'}
            </span>
            <Button
              variant="neutral"
              onClick={undo}
              className="sp-btn"
              title="Ångra (Ctrl+Z)"
            >
              <Undo2 size={16} className="mr-2" /> Ångra
            </Button>
            <div className="relative" ref={exportMenuRef}>
              <Button
                variant="neutral"
                onClick={() => setIsExportMenuOpen(open => !open)}
                disabled={loadStatus !== 'loaded'}
                className="sp-btn"
              >
                <Download size={16} className="mr-2" /> Exportera
              </Button>
              {isExportMenuOpen && (
                <div className="absolute right-0 z-[100] mt-2 w-56 bg-white p-1 sp-dropdown">
                  {([
                    ['Spara PDF (A4)', <Download key="a4" size={14} />, () => exportPdf('a4')],
                    ['Spara PDF (A3)', <Download key="a3" size={14} />, () => exportPdf('a3')],
                    ['Skriv ut (vektor)', <Printer key="p" size={14} />, printVector],
                    ['Spara PNG', <ImageIcon key="png" size={14} />, () => exportImage('png')],
                    ['Spara JPG', <ImageIcon key="jpg" size={14} />, () => exportImage('jpeg')],
                  ] as const).map(([label, icon, action]) => (
                    <button
                      key={label}
                      type="button"
                      className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm sp-menu-item"
                      onClick={() => { void action(); setIsExportMenuOpen(false); }}
                    >
                      {icon}{label}
                    </button>
                  ))}
                  <div className="my-1 border-t-2 border-gray-100" />
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm sp-menu-item"
                    onClick={() => { exportJson(); setIsExportMenuOpen(false); }}
                  >
                    <FileJson size={14} /> Spara som JSON
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm sp-menu-item"
                    onClick={() => { fileInputRef.current?.click(); setIsExportMenuOpen(false); }}
                  >
                    <Upload size={14} /> Läs in JSON som nytt hjul
                  </button>
                </div>
              )}
            </div>
            <input
              type="file"
              accept="application/json,.json"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleImportFile}
            />
            <Button
              variant="neutral"
              onClick={() => setEditingSettings(wheel)}
              className="sp-btn bg-amber-100 hover:bg-amber-200"
            >
              <Settings size={16} className="mr-2" /> {wheel.name} · {wheel.weekCount} v
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="shrink-0 lg:w-[300px]">
            <div className="sp-card p-4">
              <div className="mb-4 flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 font-bold">
                  <Palette size={18} /> Arbetsområden
                </h2>
                <Button
                  size="sm"
                  onClick={() => {
                    setManualColor(false);
                    setEditingArea({ id: uuidv4(), title: '', color: DEFAULT_AREA_COLOR });
                  }}
                  className="h-8 w-8 rounded-full p-0 sp-btn bg-[#aee8fe]"
                  aria-label="Nytt arbetsområde"
                >
                  <Plus size={16} />
                </Button>
              </div>

              {areas.length === 0 ? (
                <p className="text-sm italic text-gray-500">
                  Inga arbetsområden ännu. Skapa ett här, eller klicka på en tom tårtbit i hjulet.
                </p>
              ) : (
                areas.map(area => (
                  <AreaLibraryCard
                    key={area.id}
                    area={area}
                    isDerived={isDerivedArea(area)}
                    weeksUsed={weeksByArea.get(buildAreaKey(area.title)) ?? 0}
                    onEdit={selected => { setManualColor(true); setEditingArea(selected); }}
                    onDelete={handleDeleteArea}
                    onPointerDown={startCreate}
                  />
                ))
              )}

              <p className="mt-4 border-t-2 border-gray-100 pt-3 text-2xs leading-relaxed text-gray-500">
                Dra ut ett område i hjulet, eller klicka på en tom tårtbit. Markera en båge
                för att dra i dess ändar. Högerklicka för fler val.
              </p>
            </div>
          </div>

          <div className="sp-grid flex min-w-0 flex-1 items-center justify-center p-4">
            <div className="w-full max-w-[820px]">
              {loadStatus === 'loading' && (
                <p className="py-24 text-center text-sm font-semibold text-gray-500">
                  Hämtar hjulet…
                </p>
              )}
              {loadStatus === 'error' && (
                <p className="py-24 text-center text-sm font-semibold text-rose-700">
                  Kunde inte hämta hjulet. Ladda om sidan för att försöka igen.
                </p>
              )}
              {loadStatus === 'loaded' && (
              <ThemeWheel
                ref={svgRef}
                wheel={wheel}
                selectedInstanceId={selectedInstanceId}
                preview={preview}
                onBlockPointerDown={(event, block, placement) => {
                  setSelectedInstanceId(block.instanceId);
                  startMove(block, placement, event);
                }}
                onBlockResizeStart={(event, block, placement, edge) => startResize(block, placement, edge, event)}
                onSelectBlock={block => setSelectedInstanceId(block.instanceId)}
                onOpenBlockEditor={block => { setManualColor(true); setEditingBlock(block); }}
                onBlockContextMenu={(event, block) => setContextMenu({
                  kind: 'block', x: event.clientX, y: event.clientY, block,
                })}
                onEmptyCellClick={(week, ring, parentId) => openNewBlockEditor(week, ring, parentId)}
                onWeekClick={week => openNewBlockEditor(week)}
                onWeekContextMenu={(event, week) => setContextMenu({
                  kind: 'week', x: event.clientX, y: event.clientY, week,
                })}
                onBackgroundClick={() => setSelectedInstanceId(null)}
              />
              )}
            </div>
          </div>

          <ThemeWheelArchive
            wheels={wheels}
            activeId={wheel.id}
            isBusy={isBusy}
            collapsed={isArchiveCollapsed}
            onToggleCollapsed={() => setIsArchiveCollapsed(prev => !prev)}
            onSelect={selectWheel}
            onCreate={createWheel}
            onDuplicate={duplicateWheel}
            onDelete={deleteWheel}
            onShare={shareWheel}
          />
        </div>
      </div>

      {contextMenu && (
        <div
          className="fixed z-[100] flex w-max flex-col bg-white sp-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          {contextMenu.kind === 'block' ? (
            <>
              <button
                className="px-3 py-2 text-left text-sm sp-menu-item"
                onClick={() => { setManualColor(true); setEditingBlock(contextMenu.block); setContextMenu(null); }}
              >
                Redigera
              </button>
              <button
                className="px-3 py-2 text-left text-sm sp-menu-item"
                onClick={() => handleDuplicateBlock(contextMenu.block)}
              >
                Duplicera
              </button>
              {contextMenu.block.parentId ? (
                <button
                  className="px-3 py-2 text-left text-sm sp-menu-item"
                  onClick={() => {
                    handleUpdateBlock(contextMenu.block.instanceId, { parentId: undefined });
                    setContextMenu(null);
                  }}
                >
                  Lyft ut ur arbetsområdet
                </button>
              ) : (
                <button
                  className="px-3 py-2 text-left text-sm sp-menu-item"
                  onClick={() => addChildTo(contextMenu.block)}
                >
                  Lägg till delområde
                </button>
              )}
              <button
                className="px-3 py-2 text-left text-sm sp-menu-item"
                onClick={() => handleUpdateBlock(contextMenu.block.instanceId, { ring: undefined })}
              >
                Placera ringen automatiskt
              </button>
              <button
                className="px-3 py-2 text-left text-sm text-rose-700 sp-menu-item"
                onClick={() => handleRemoveBlock(contextMenu.block.instanceId)}
              >
                Ta bort
              </button>
            </>
          ) : (
            <>
              <button
                className="px-3 py-2 text-left text-sm sp-menu-item"
                onClick={() => { openNewBlockEditor(contextMenu.week); setContextMenu(null); }}
              >
                Lägg till arbetsområde
              </button>
              <button
                className="px-3 py-2 text-left text-sm sp-menu-item"
                onClick={() => toggleHolidayWeek(contextMenu.week)}
              >
                {wheel.holidayWeeks.includes(contextMenu.week) ? 'Ta bort lovmarkering' : 'Markera som lov'}
              </button>
            </>
          )}
        </div>
      )}

      <ThemeWheelModals
        weeks={weeks}
        manualColor={manualColor}
        setManualColor={setManualColor}
        editingArea={editingArea}
        setEditingArea={setEditingArea}
        onSaveArea={handleSaveArea}
        onCloseArea={() => setEditingArea(null)}
        editingBlock={editingBlock}
        setEditingBlock={setEditingBlock}
        onSaveBlock={handleSaveBlock}
        onCloseBlock={() => setEditingBlock(null)}
        onDeleteBlock={instanceId => { handleRemoveBlock(instanceId); setEditingBlock(null); }}
        isExistingBlock={Boolean(
          editingBlock && wheel.blocks.some(block => block.instanceId === editingBlock.instanceId)
        )}
        blockParent={
          editingBlock?.parentId
            ? wheel.blocks.find(block => block.instanceId === editingBlock.parentId) ?? null
            : null
        }
        editingSettings={editingSettings}
        setEditingSettings={setEditingSettings}
        onSaveSettings={handleSaveSettings}
        onCloseSettings={() => setEditingSettings(null)}
        deleteAreaName={deleteAreaName}
        onCancelDeleteArea={() => setDeleteAreaId(null)}
        onConfirmDeleteArea={() => {
          setManualAreas(prev => prev.filter(area => area.id !== deleteAreaId));
          setDeleteAreaId(null);
        }}
      />

      {/* z-1400 lägger toasten över dialogerna (z-1300), så att t.ex. ett
          delningsfel syns medan rutan fortfarande är öppen. */}
      {plannerNotice && (
        <div className={`fixed bottom-4 right-4 z-[1400] sp-toast px-4 py-3 text-sm font-semibold ${
          plannerNotice.tone === 'success' ? 'bg-emerald-100 text-emerald-900'
            : plannerNotice.tone === 'warning' ? 'bg-amber-100 text-amber-900'
              : 'bg-rose-100 text-rose-900'
        }`}>
          {plannerNotice.message}
        </div>
      )}
    </div>
  );
}
