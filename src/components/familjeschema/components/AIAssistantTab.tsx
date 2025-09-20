import { useState } from 'react';

import { scheduleService } from '@/services/scheduleService';
import type { ActivityImportItem } from '@/types/schedule';
import { normalizeActivitiesForBackend } from '@/utils/normalizeActivities';

interface AIAssistantTabProps {
  selectedWeek: number;
  selectedYear: number;
  onPreview: (
    ok: ActivityImportItem[],
    errors: { index: number; message: string }[],
  ) => void;
}

export function AIAssistantTab({ selectedWeek, selectedYear, onPreview }: AIAssistantTabProps) {
  const [naturalInput, setNaturalInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleParse = async () => {
    const text = naturalInput.trim();
    if (!text) return;

    setIsProcessing(true);
    setError(null);
    try {
      const aiItems = await scheduleService.parseScheduleWithAI(text, selectedWeek, selectedYear);
      const { ok, errors } = normalizeActivitiesForBackend(aiItems, selectedWeek, selectedYear);
      onPreview(ok, errors);

      if (!ok.length) {
        setError(errors[0]?.message || 'AI gav inga giltiga aktiviteter.');
        return;
      }

      if (errors.length) {
        setError('Vissa rader kunde inte tolkas. Se detaljerna nedan.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte tolka texten.');
      onPreview([], []);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="form-group">
        <label htmlFor="ai-freeform" className="form-label">
          Beskriv veckan med naturligt språk
        </label>
        <textarea
          id="ai-freeform"
          className="form-textarea"
          rows={6}
          value={naturalInput}
          onChange={(event) => setNaturalInput(event.target.value)}
          placeholder="T.ex. Måndag 18:00-19:00 simning för Rut..."
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          className="btn btn-success"
          onClick={handleParse}
          disabled={isProcessing || !naturalInput.trim()}
        >
          {isProcessing ? 'Tolkar…' : 'Tolka med AI'}
        </button>
        <span className="text-sm text-gray-600">
          Aktuell vecka: {selectedWeek}, år {selectedYear}
        </span>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
