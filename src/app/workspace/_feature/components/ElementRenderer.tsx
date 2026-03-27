'use client';

import type { WorkspaceElement } from '../types/workspace.types';
import TextEditor from './editors/TextEditor';
import TableEditor, { type TableContent } from './editors/TableEditor';
import MindmapEditor, { type MindmapContent } from './editors/MindmapEditor';
import ListEditor, { type ListContent } from './editors/ListEditor';

interface ElementRendererProps {
  element: WorkspaceElement;
  isLocked: boolean;
  onChange: (content: unknown) => void;
}

export default function ElementRenderer({
  element,
  isLocked,
  onChange,
}: ElementRendererProps) {
  switch (element.type) {
    case 'text':
      return (
        <TextEditor
          content={element.content as object | null}
          isLocked={isLocked}
          onChange={onChange}
        />
      );

    case 'table':
      return (
        <TableEditor
          content={element.content as TableContent}
          isLocked={isLocked}
          onChange={onChange}
        />
      );

    case 'mindmap':
      return (
        <MindmapEditor
          content={element.content as MindmapContent}
          isLocked={isLocked}
          onChange={onChange}
        />
      );

    case 'list':
      return (
        <ListEditor
          content={element.content as ListContent}
          isLocked={isLocked}
          onChange={onChange}
        />
      );

    default:
      return <p style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Okänd elementtyp</p>;
  }
}
