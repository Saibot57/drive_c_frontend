'use client';

import type { WorkspaceElement } from '../types/workspace.types';
import type { PdfContent } from '../types/pdf.types';
import type { ImageContent } from '../types/image.types';
import type { LinkContent } from '../types/link.types';
import TextEditor from './editors/TextEditor';
import TableEditor, { type TableContent } from './editors/TableEditor';
import MindmapEditor, { type MindmapContent } from './editors/MindmapEditor';
import ListEditor, { type ListContent } from './editors/ListEditor';
import KanbanEditor, { type KanbanContent } from './editors/KanbanEditor';
import StickyEditor, { type StickyContent } from './editors/StickyEditor';
import PdfViewer from './editors/PdfViewer';
import ImageViewer from './editors/ImageViewer';
import LinkEditor from './editors/LinkEditor';

interface ElementRendererProps {
  element: WorkspaceElement;
  isLocked: boolean;
  /** Passed through to PdfViewer for click-to-focus pointer-events handling. */
  isSelected: boolean;
  onChange: (content: unknown) => void;
}

export default function ElementRenderer({
  element,
  isLocked,
  isSelected,
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

    case 'kanban':
      return (
        <KanbanEditor
          content={element.content as KanbanContent}
          isLocked={isLocked}
          onChange={onChange}
        />
      );

    case 'sticky':
      return (
        <StickyEditor
          content={element.content as StickyContent}
          isLocked={isLocked}
          onChange={onChange}
        />
      );

    case 'pdf':
      return (
        <PdfViewer
          content={element.content as PdfContent}
          isLocked={isLocked}
          isSelected={isSelected}
          onChange={onChange}
        />
      );

    case 'image':
      return (
        <ImageViewer
          content={element.content as ImageContent}
          isLocked={isLocked}
          isSelected={isSelected}
          onChange={onChange}
        />
      );

    case 'link':
      return (
        <LinkEditor
          content={element.content as LinkContent | null}
          isLocked={isLocked}
          isSelected={isSelected}
          onChange={onChange}
        />
      );

    default:
      return <p style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Okänd elementtyp</p>;
  }
}
