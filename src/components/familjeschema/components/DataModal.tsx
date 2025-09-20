// src/components/DataModal.tsx

import React, { useState } from 'react';
import { X, Upload, FileText, Download, Sparkles } from 'lucide-react';

import type { ActivityImportItem } from '@/types/schedule';

import { AIAssistantTab } from './AIAssistantTab';

interface DataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFileImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onTextImport: (jsonText: string) => void;
  onExportJSON: () => void;
  onExportICS: () => void;
  selectedWeek: number;
  selectedYear: number;
  onAIPreview: (activities: ActivityImportItem[]) => void;
  aiPreviewActivities: ActivityImportItem[];
  onAIImport: () => void;
  aiImporting: boolean;
  aiImportError: string | null;
}

export const DataModal: React.FC<DataModalProps> = ({
  isOpen,
  onClose,
  onFileImport,
  onTextImport,
  onExportJSON,
  onExportICS,
  selectedWeek,
  selectedYear,
  onAIPreview,
  aiPreviewActivities,
  onAIImport,
  aiImporting,
  aiImportError,
}) => {
  const [jsonText, setJsonText] = useState('');
  const [activeTab, setActiveTab] = useState<'paste' | 'file' | 'export' | 'ai'>('ai');

  if (!isOpen) {
    return null;
  }

  const handleImportClick = () => {
    if (jsonText.trim()) {
      onTextImport(jsonText);
      setJsonText('');
    }
  };

  const renderAIPreview = () => {
    const hasPreview = aiPreviewActivities.length > 0;
    return (
      <div className="space-y-3">
        <AIAssistantTab
          selectedWeek={selectedWeek}
          selectedYear={selectedYear}
          onPreview={onAIPreview}
        />

        {aiImportError && (
          <pre
            className="text-sm"
            style={{
              color: '#dc2626',
              backgroundColor: '#fef2f2',
              borderRadius: '8px',
              padding: '8px',
              whiteSpace: 'pre-wrap',
            }}
          >
            {aiImportError}
          </pre>
        )}

        {hasPreview && (
          <div className="ai-preview-table" style={{ maxHeight: '220px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: '6px' }}>Namn</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: '6px' }}>Tid</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: '6px' }}>Dag(ar)</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: '6px' }}>Vecka</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: '6px' }}>År</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: '6px' }}>Deltagare</th>
                </tr>
              </thead>
              <tbody>
                {aiPreviewActivities.map((activity, idx) => (
                  <tr key={idx}>
                    <td style={{ padding: '6px', borderBottom: '1px solid #eee' }}>{activity.name}</td>
                    <td style={{ padding: '6px', borderBottom: '1px solid #eee' }}>
                      {activity.startTime} – {activity.endTime}
                    </td>
                    <td style={{ padding: '6px', borderBottom: '1px solid #eee' }}>
                      {activity.days.join(', ')}
                    </td>
                    <td style={{ padding: '6px', borderBottom: '1px solid #eee' }}>{activity.week}</td>
                    <td style={{ padding: '6px', borderBottom: '1px solid #eee' }}>{activity.year}</td>
                    <td style={{ padding: '6px', borderBottom: '1px solid #eee' }}>
                      {activity.participants.join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!hasPreview && !aiImportError && (
          <p className="text-sm text-gray-600">
            Tolka en beskrivning för att förhandsgranska aktiviteter innan import.
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: '640px' }} onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2 id="data-modal-title" className="modal-title">
            Importera / Exportera Data
          </h2>
          <button className="modal-close" onClick={onClose} aria-label="Stäng modal">
            <X size={24} />
          </button>
        </div>

        <div className="data-modal-tabs">
          <button
            className={`tab-btn ${activeTab === 'ai' ? 'active' : ''}`}
            onClick={() => setActiveTab('ai')}
          >
            <Sparkles size={18} /> AI-assistent
          </button>
          <button
            className={`tab-btn ${activeTab === 'paste' ? 'active' : ''}`}
            onClick={() => setActiveTab('paste')}
          >
            <FileText size={18} /> Klistra in JSON
          </button>
          <button
            className={`tab-btn ${activeTab === 'file' ? 'active' : ''}`}
            onClick={() => setActiveTab('file')}
          >
            <Upload size={18} /> Ladda upp Fil
          </button>
          <button
            className={`tab-btn ${activeTab === 'export' ? 'active' : ''}`}
            onClick={() => setActiveTab('export')}
          >
            <Download size={18} /> Exportera
          </button>
        </div>

        <div className="modal-body">
          {activeTab === 'ai' && renderAIPreview()}

          {activeTab === 'paste' && (
            <div className="form-group">
              <label htmlFor="json-paste-area" className="form-label">
                Klistra in din JSON-data här
              </label>
              <textarea
                id="json-paste-area"
                rows={10}
                className="form-textarea"
                placeholder="[{...}]"
                value={jsonText}
                onChange={(event) => setJsonText(event.target.value)}
              />
            </div>
          )}

          {activeTab === 'file' && (
            <div className="form-group" style={{ textAlign: 'center', padding: '40px 0' }}>
              <label className="btn btn-primary" style={{ display: 'inline-flex' }}>
                <Upload size={20} /> Välj JSON-fil
                <input
                  type="file"
                  accept=".json"
                  style={{ display: 'none' }}
                  onChange={onFileImport}
                />
              </label>
            </div>
          )}

          {activeTab === 'export' && (
            <div className="form-group" style={{ textAlign: 'center', padding: '20px 0' }}>
              <p className="form-label" style={{ marginBottom: '20px' }}>
                Ladda ner all schemadata i önskat format.
              </p>
              <div className="btn-group" style={{ justifyContent: 'center' }}>
                <button className="btn btn-success" onClick={onExportJSON}>
                  <Download size={20} /> Exportera som JSON
                </button>
                <button className="btn btn-info" onClick={onExportICS}>
                  <Download size={20} /> Exportera som ICS
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose}>
            Avbryt
          </button>
          {activeTab === 'paste' && (
            <button
              className="btn btn-success"
              onClick={handleImportClick}
              disabled={!jsonText.trim()}
            >
              Importera text
            </button>
          )}
          {activeTab === 'ai' && aiPreviewActivities.length > 0 && (
            <button
              className="btn btn-success"
              onClick={onAIImport}
              disabled={aiImporting}
            >
              {aiImporting ? 'Importerar…' : `Importera ${aiPreviewActivities.length} aktiviteter`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
