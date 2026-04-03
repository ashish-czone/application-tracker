import { useCallback, useRef } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Mention from '@tiptap/extension-mention';
import {
  Bold, Italic, Underline as UnderlineIcon,
  List, ListOrdered, Link as LinkIcon, Send,
} from 'lucide-react';
import { Button, cn } from '@packages/ui';
import { MentionList } from './MentionList';
import { createRoot } from 'react-dom/client';

interface NoteEditorProps {
  onSubmit: (html: string) => void;
  initialContent?: string;
  isSubmitting?: boolean;
  onCancel?: () => void;
  placeholder?: string;
  searchUsers: (query: string) => Promise<{ id: string; label: string }[]>;
}

export function NoteEditor({
  onSubmit,
  initialContent = '',
  isSubmitting = false,
  onCancel,
  placeholder = 'Write a note... Use @ to mention someone',
  searchUsers,
}: NoteEditorProps) {
  const editorRef = useRef<Editor | null>(null);

  const handleSubmit = useCallback(() => {
    if (!editorRef.current) return;
    const html = editorRef.current.getHTML();
    if (html === '<p></p>' || !html.trim()) return;
    onSubmit(html);
    editorRef.current.commands.clearContent();
  }, [onSubmit]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-primary underline cursor-pointer' },
      }),
      Placeholder.configure({ placeholder }),
      Mention.configure({
        HTMLAttributes: {
          class: 'mention',
        },
        suggestion: {
          items: async ({ query }: { query: string }) => {
            if (!query) return [];
            return searchUsers(query);
          },
          render: () => {
            let container: HTMLElement | null = null;
            let root: ReturnType<typeof createRoot> | null = null;
            let component: { onKeyDown: (props: { event: KeyboardEvent }) => boolean } | null = null;

            return {
              onStart: (props: any) => {
                container = document.createElement('div');
                container.style.position = 'absolute';
                container.style.zIndex = '50';
                root = createRoot(container);
                root.render(
                  <MentionList
                    ref={(ref) => { component = ref; }}
                    items={props.items}
                    command={props.command}
                  />,
                );
                if (props.clientRect) {
                  const rect = props.clientRect();
                  if (rect) {
                    container.style.left = `${rect.left}px`;
                    container.style.top = `${rect.bottom + 4}px`;
                  }
                }
                document.body.appendChild(container);
              },
              onUpdate: (props: any) => {
                if (root) {
                  root.render(
                    <MentionList
                      ref={(ref) => { component = ref; }}
                      items={props.items}
                      command={props.command}
                    />,
                  );
                }
                if (container && props.clientRect) {
                  const rect = props.clientRect();
                  if (rect) {
                    container.style.left = `${rect.left}px`;
                    container.style.top = `${rect.bottom + 4}px`;
                  }
                }
              },
              onKeyDown: (props: any) => {
                if (props.event.key === 'Escape') {
                  if (container) {
                    root?.unmount();
                    container.remove();
                    container = null;
                  }
                  return true;
                }
                return component?.onKeyDown(props) ?? false;
              },
              onExit: () => {
                if (container) {
                  root?.unmount();
                  container.remove();
                  container = null;
                }
              },
            };
          },
        },
      }),
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[80px] px-3 py-2',
      },
      handleKeyDown: (_view, event) => {
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
          handleSubmit();
          return true;
        }
        return false;
      },
    },
  });

  editorRef.current = editor;

  if (!editor) return null;

  return (
    <div className="rounded-md border border-input bg-background ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
      {/* Editor content */}
      <EditorContent editor={editor} />

      {/* Bottom bar: toolbar + actions */}
      <div className="flex items-center justify-between border-t border-input px-2 py-1">
        <div className="flex items-center gap-0.5">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive('bold')}
            title="Bold"
          >
            <Bold className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive('italic')}
            title="Italic"
          >
            <Italic className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            active={editor.isActive('underline')}
            title="Underline"
          >
            <UnderlineIcon className="h-3.5 w-3.5" />
          </ToolbarButton>
          <div className="w-px h-4 bg-border mx-0.5" />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive('bulletList')}
            title="Bullet List"
          >
            <List className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive('orderedList')}
            title="Ordered List"
          >
            <ListOrdered className="h-3.5 w-3.5" />
          </ToolbarButton>
          <div className="w-px h-4 bg-border mx-0.5" />
          <ToolbarButton
            onClick={() => {
              const url = window.prompt('Enter URL');
              if (url) editor.chain().focus().setLink({ href: url }).run();
            }}
            active={editor.isActive('link')}
            title="Insert Link"
          >
            <LinkIcon className="h-3.5 w-3.5" />
          </ToolbarButton>
        </div>

        <div className="flex items-center gap-2">
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
          )}
          <Button size="sm" onClick={handleSubmit} disabled={isSubmitting}>
            <Send className="h-3.5 w-3.5 mr-1" />
            {onCancel ? 'Save' : 'Add Note'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'p-1 rounded text-muted-foreground transition-colors',
        'hover:text-foreground hover:bg-accent',
        active && 'bg-accent text-foreground',
      )}
    >
      {children}
    </button>
  );
}
