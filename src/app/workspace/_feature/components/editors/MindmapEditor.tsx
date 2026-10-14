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
    <div className="ws-mindmap">
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
    <div className="ws-mindmap__branch">
      {/* The node pill */}
      <div className={`ws-mindmap__node${isRoot ? ' ws-mindmap__node--root' : ''}`}>
        {isLocked ? (
          <span>{node.label}</span>
        ) : (
          <input
            value={node.label}
            onChange={(e) => onUpdate(node.id, e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="ws-editor-bare-input"
            style={{ width: `${Math.max(node.label.length, 3)}ch` }}
          />
        )}
        {!isLocked && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddChild(node.id);
            }}
            title="Lägg till barn"
            className="ws-editor-icon-btn ws-mindmap__add"
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
            className="ws-editor-icon-btn"
          >
            <X size={10} />
          </button>
        )}
      </div>

      {/* Children branch */}
      {node.children.length > 0 && (
        <div className="ws-mindmap__children">
          {/* Connector line */}
          {node.children.map((child) => (
            <div key={child.id} className="ws-mindmap__branch">
              <div className="ws-mindmap__connector" />
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
