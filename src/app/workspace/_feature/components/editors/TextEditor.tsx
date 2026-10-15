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
    // Tiptap 3 vägrar skapa editorn under första renderingen i en Next-app om
    // det här inte är satt: i dev kastar den och tar hela canvasen med sig så
    // fort ett textkort ritas. Editorn skapas i stället efter monteringen, och
    // `if (!editor) return null` nedan täcker rutan innan dess.
    immediatelyRender: false,
    extensions: [StarterKit],
    content: content ?? { type: 'doc', content: [{ type: 'paragraph' }] },
    editable: !isLocked,
    onUpdate: ({ editor: e }) => {
      onChange(e.getJSON());
    },
    editorProps: {
      attributes: {
        class: 'ws-text-editor__content',
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
    <div className="ws-text-editor">
      {/* Mini toolbar — only when unlocked */}
      {!isLocked && (
        <div className="ws-text-editor__toolbar">
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

      <div className="ws-text-editor__scroll">
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
      className={`ws-text-editor__btn${active ? ' ws-text-editor__btn--active' : ''}`}
    >
      {children}
    </button>
  );
}
