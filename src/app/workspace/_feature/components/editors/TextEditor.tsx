'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect } from 'react';
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Code2,
} from 'lucide-react';

interface TextEditorProps {
  content: object | null;
  isLocked: boolean;
  onChange: (content: object) => void;
}

export default function TextEditor({
  content,
  isLocked,
  onChange,
}: TextEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: content ?? { type: 'doc', content: [{ type: 'paragraph' }] },
    editable: !isLocked,
    onUpdate: ({ editor: e }) => {
      onChange(e.getJSON());
    },
    editorProps: {
      attributes: {
        style:
          'outline: none; font-size: 0.875rem; line-height: 1.6; color: #374151; min-height: 3rem; padding: 0;',
      },
    },
  });

  useEffect(() => {
    if (editor) {
      editor.setEditable(!isLocked);
    }
  }, [isLocked, editor]);

  if (!editor) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Mini toolbar — only when unlocked */}
      {!isLocked && (
        <div
          style={{
            display: 'flex',
            gap: '2px',
            padding: '0.25rem 0',
            marginBottom: '0.25rem',
            borderBottom: '1px solid #f3f4f6',
            flexWrap: 'wrap',
          }}
        >
          <ToolbarBtn
            active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Fet"
          >
            <Bold size={14} />
          </ToolbarBtn>
          <ToolbarBtn
            active={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Kursiv"
          >
            <Italic size={14} />
          </ToolbarBtn>
          <ToolbarBtn
            active={editor.isActive('heading', { level: 1 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            title="Rubrik 1"
          >
            <Heading1 size={14} />
          </ToolbarBtn>
          <ToolbarBtn
            active={editor.isActive('heading', { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            title="Rubrik 2"
          >
            <Heading2 size={14} />
          </ToolbarBtn>
          <ToolbarBtn
            active={editor.isActive('heading', { level: 3 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            title="Rubrik 3"
          >
            <Heading3 size={14} />
          </ToolbarBtn>
          <ToolbarBtn
            active={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title="Punktlista"
          >
            <List size={14} />
          </ToolbarBtn>
          <ToolbarBtn
            active={editor.isActive('orderedList')}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            title="Numrerad lista"
          >
            <ListOrdered size={14} />
          </ToolbarBtn>
          <ToolbarBtn
            active={editor.isActive('codeBlock')}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            title="Kodblock"
          >
            <Code2 size={14} />
          </ToolbarBtn>
        </div>
      )}

      <div style={{ flex: 1, overflow: 'auto' }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function ToolbarBtn({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={title}
      style={{
        width: '1.5rem',
        height: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        borderRadius: '0.25rem',
        background: active ? '#e5e7eb' : 'transparent',
        color: active ? '#111827' : '#6b7280',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}
