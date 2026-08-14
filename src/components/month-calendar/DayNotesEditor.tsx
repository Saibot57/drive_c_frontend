'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Heading1, Heading2, Heading3, Pilcrow } from 'lucide-react';
import { useEffect, useRef } from 'react';

import type { NoteDocument } from '@/services/monthCalendarService';

const EMPTY_DOC: NoteDocument = { type: 'doc', content: [{ type: 'paragraph' }] };

interface Props {
  /** Dagens nyckel. Byte av den laddar om dokumentet. */
  dateKey: string;
  doc: NoteDocument | null;
  onChange: (doc: NoteDocument) => void;
}

export default function DayNotesEditor({ dateKey, doc, onChange }: Props) {
  const currentKey = useRef(dateKey);

  const editor = useEditor({
    // Tiptap 3 vägrar skapa editorn under Next:s första rendering utan den här.
    // Samma flagga finns i workspace-editorn, av samma anledning.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        // v1 håller sig till brödtext och H1–H3.
        bulletList: false,
        orderedList: false,
        listItem: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
      }),
    ],
    content: doc ?? EMPTY_DOC,
    editorProps: {
      attributes: { class: 'mc-editor-content' },
    },
    onUpdate: ({ editor: e }) => onChange(e.getJSON() as NoteDocument),
  });

  // Dagbyte: ladda in den nya dagens dokument.
  //
  // `emitUpdate: false` är hela poängen — utan den triggar setContent ett
  // onUpdate, som skulle köa en sparning av den nya dagen med innehåll som
  // användaren aldrig rört, och samtidigt markera dagen som ändrad.
  // (Tiptap 2 tog en boolean här; i 3 är det ett options-objekt.)
  useEffect(() => {
    if (!editor) return;
    if (currentKey.current === dateKey) return;
    currentKey.current = dateKey;
    editor.commands.setContent(doc ?? EMPTY_DOC, { emitUpdate: false });
  }, [dateKey, doc, editor]);

  if (!editor) return null;

  const level = (n: 1 | 2 | 3) => editor.isActive('heading', { level: n });

  return (
    <>
      <div className="flex flex-wrap gap-1 px-4 pt-2" role="toolbar" aria-label="Textformat">
        <ToolbarBtn
          active={editor.isActive('paragraph')}
          onClick={() => editor.chain().focus().setParagraph().run()}
          label="Brödtext"
        >
          <Pilcrow size={14} />
        </ToolbarBtn>
        {([1, 2, 3] as const).map((n) => (
          <ToolbarBtn
            key={n}
            active={level(n)}
            onClick={() => editor.chain().focus().toggleHeading({ level: n }).run()}
            label={`Rubrik ${n}`}
          >
            {n === 1 ? <Heading1 size={14} /> : n === 2 ? <Heading2 size={14} /> : <Heading3 size={14} />}
          </ToolbarBtn>
        ))}
      </div>

      <div className="mc-editor-wrap">
        <div className="mc-editor">
          <EditorContent editor={editor} />
        </div>
      </div>
    </>
  );
}

function ToolbarBtn({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`mc-btn mc-btn--icon${active ? ' mc-btn--active' : ''}`}
    >
      {children}
    </button>
  );
}
