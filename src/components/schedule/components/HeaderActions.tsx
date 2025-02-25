'use client';

import React from 'react';
import {
  Download,
  Upload,
  Trash2,
  Printer,
  Loader2,
  Settings
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { ExportOptions } from '../utils/export';

interface HeaderActionsProps {
  onClearSchedule: () => void;
  onExportSchedule: () => void;
  onImportSchedule: () => void;
  onSaveSchedule: (options?: ExportOptions) => void;
  onConfigToggle?: () => void;
  isExporting?: boolean;
  isImporting?: boolean;
  isSaving?: boolean;
}

export function HeaderActions({
  onClearSchedule,
  onExportSchedule,
  onImportSchedule,
  onSaveSchedule,
  onConfigToggle,
  isExporting = false,
  isImporting = false,
  isSaving = false
}: HeaderActionsProps) {
  return (
    <div className="flex items-center space-x-2">
      <Button
        variant="neutral"
        onClick={onExportSchedule}
        disabled={isExporting}
        className="h-10 w-10 p-0 rounded-lg"
        title="Exportera JSON"
      >
        {isExporting ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Download className="h-5 w-5" />
        )}
      </Button>

      <Button
        variant="neutral"
        onClick={onImportSchedule}
        disabled={isImporting}
        className="h-10 w-10 p-0 rounded-lg"
        title="Importera JSON"
      >
        {isImporting ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Upload className="h-5 w-5" />
        )}
      </Button>

      <Button
        variant="neutral"
        onClick={() => onSaveSchedule()}
        disabled={isSaving}
        className="h-10 w-10 p-0 rounded-lg"
        title="Spara som PDF"
      >
        {isSaving ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Printer className="h-5 w-5" />
        )}
      </Button>

      {onConfigToggle && (
        <Button
          variant="neutral"
          onClick={onConfigToggle}
          className="h-10 w-10 p-0 rounded-lg"
          title="Inställningar"
        >
          <Settings className="h-5 w-5" />
        </Button>
      )}

      <Button
        variant="neutral"
        onClick={onClearSchedule}
        className="h-10 w-10 p-0 rounded-lg"
        title="Rensa schema"
      >
        <Trash2 className="h-5 w-5" />
      </Button>
    </div>
  );
}