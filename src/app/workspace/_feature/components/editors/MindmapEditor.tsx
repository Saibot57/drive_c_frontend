'use client';

import { useCallback } from 'react';
import { Plus, X } from 'lucide-react';

export interface MindmapNode {
  id: string;
  label: string;
  children: MindmapNode[];
}

export interface MindmapContent {
  root: MindmapNode;
}

interface MindmapEditorProps {
  content: MindmapContent;
  isLocked: boolean;
  onChange: (content: MindmapContent) => void;
}

const defaultContent: MindmapContent = {
  root: { id: '1', label: 'Central nod', children: [] },
};

export default function MindmapEditor({
  content: rawContent,
  isLocked,
  onChange,
}: MindmapEditorProps) {
  const content: MindmapContent = rawContent && rawContent.root ? rawContent : defaultContent;

  const updateNode = useCallback(
    (nodeId: string, label: string) => {
      const updated = deepUpdateNode(content.root, nodeId, label);
      onChange({ root: updated });
    },
    [content, onChange],
  );

  const addChild = useCallback(
    (parentId: string) => {
      const newId = String(Date.now());
      const updated = deepAddChild(content.root, parentId, {
        id: newId,
        label: 'Ny nod',
        children: [],
      });
      onChange({ root: updated });
    },
    [content, onChange],
  );

  const removeNode = useCallback(
    (nodeId: string) => {
      if (nodeId === content.root.id) return; // can't remove root
      const updated = deepRemoveNode(content.root, nodeId);
      if (updated) onChange({ root: updated });
    },
    [content, onChange],
  );

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        overflow: 'auto',
        height: '100%',
        padding: '0.5rem',
        fontSize: '0.8125rem',
      }}
    >
      <NodeView
        node={content.root}
        isRoot
        isLocked={isLocked}
        onUpdate={updateNode}
        onAddChild={addChild}
        onRemove={removeNode}
      />
    </div>
  );
}

function NodeView({
  node,
  isRoot,
  isLocked,
  onUpdate,
  onAddChild,
  onRemove,
}: {
  node: MindmapNode;
  isRoot: boolean;
  isLocked: boolean;
  onUpdate: (id: string, label: string) => void;
  onAddChild: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {/* The node pill */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '0.25rem 0.625rem',
          borderRadius: '9999px',
          border: '1px solid #d1d5db',
          background: isRoot ? '#f0f9ff' : '#ffffff',
          whiteSpace: 'nowrap',
          position: 'relative',
        }}
      >
        {isLocked ? (
          <span>{node.label}</span>
        ) : (
          <input
            value={node.label}
            onChange={(e) => onUpdate(node.id, e.target.value)}
            onClick={(e) => e.stopPropagation()}
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: 'inherit',
              outline: 'none',
              padding: 0,
              width: `${Math.max(node.label.length, 3)}ch`,
            }}
          />
        )}
        {!isLocked && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddChild(node.id);
            }}
            title="Lägg till barn"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#9ca3af',
              padding: 0,
              display: 'flex',
            }}
          >
            <Plus size={12} />
          </button>
        )}
        {!isLocked && !isRoot && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(node.id);
            }}
            title="Ta bort"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#d1d5db',
              padding: 0,
              display: 'flex',
            }}
          >
            <X size={10} />
          </button>
        )}
      </div>

      {/* Children branch */}
      {node.children.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', marginLeft: '0.75rem', gap: '0.375rem' }}>
          {/* Connector line */}
          {node.children.map((child) => (
            <div key={child.id} style={{ display: 'flex', alignItems: 'center' }}>
              <div
                style={{
                  width: '0.75rem',
                  height: '1px',
                  background: '#d1d5db',
                  flexShrink: 0,
                }}
              />
              <NodeView
                node={child}
                isRoot={false}
                isLocked={isLocked}
                onUpdate={onUpdate}
                onAddChild={onAddChild}
                onRemove={onRemove}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tree manipulation helpers ──

function deepUpdateNode(node: MindmapNode, id: string, label: string): MindmapNode {
  if (node.id === id) return { ...node, label };
  return {
    ...node,
    children: node.children.map((c) => deepUpdateNode(c, id, label)),
  };
}

function deepAddChild(node: MindmapNode, parentId: string, child: MindmapNode): MindmapNode {
  if (node.id === parentId) {
    return { ...node, children: [...node.children, child] };
  }
  return {
    ...node,
    children: node.children.map((c) => deepAddChild(c, parentId, child)),
  };
}

function deepRemoveNode(node: MindmapNode, id: string): MindmapNode | null {
  if (node.id === id) return null;
  return {
    ...node,
    children: node.children
      .map((c) => deepRemoveNode(c, id))
      .filter((c): c is MindmapNode => c !== null),
  };
}
