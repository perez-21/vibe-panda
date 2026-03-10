import { useState, useEffect } from "react";
import type { Editor } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Bold,
  Italic,
  Underline,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Code,
  Quote,
  Minus,
  Table,
  Undo,
  Redo,
  ImageIcon,
  Sigma,
  SquareSigma,
} from "lucide-react";

interface EditorToolbarProps {
  editor: Editor | null;
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!editor) return;
    const handler = () => setTick((t) => t + 1);
    editor.on("transaction", handler);
    return () => {
      editor.off("transaction", handler);
    };
  }, [editor]);

  if (!editor) return null;

  type ToolbarItem = {
    icon: React.ComponentType<{ className?: string }>;
    action: () => void;
    active: boolean;
    testId: string;
    title: string;
    disabled?: boolean;
  };

  const tools: { group: string; items: ToolbarItem[] }[] = [
    {
      group: "history",
      items: [
        {
          icon: Undo,
          action: () => editor.chain().focus().undo().run(),
          active: false,
          disabled: !editor.can().undo(),
          testId: "button-editor-undo",
          title: "Undo",
        },
        {
          icon: Redo,
          action: () => editor.chain().focus().redo().run(),
          active: false,
          disabled: !editor.can().redo(),
          testId: "button-editor-redo",
          title: "Redo",
        },
      ],
    },
    {
      group: "headings",
      items: [
        {
          icon: Heading1,
          action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
          active: editor.isActive("heading", { level: 1 }),
          testId: "button-editor-h1",
          title: "Heading 1",
        },
        {
          icon: Heading2,
          action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
          active: editor.isActive("heading", { level: 2 }),
          testId: "button-editor-h2",
          title: "Heading 2",
        },
        {
          icon: Heading3,
          action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
          active: editor.isActive("heading", { level: 3 }),
          testId: "button-editor-h3",
          title: "Heading 3",
        },
      ],
    },
    {
      group: "marks",
      items: [
        {
          icon: Bold,
          action: () => editor.chain().focus().toggleBold().run(),
          active: editor.isActive("bold"),
          testId: "button-editor-bold",
          title: "Bold",
        },
        {
          icon: Italic,
          action: () => editor.chain().focus().toggleItalic().run(),
          active: editor.isActive("italic"),
          testId: "button-editor-italic",
          title: "Italic",
        },
        {
          icon: Underline,
          action: () => editor.chain().focus().toggleUnderline().run(),
          active: editor.isActive("underline"),
          testId: "button-editor-underline",
          title: "Underline",
        },
      ],
    },
    {
      group: "blocks",
      items: [
        {
          icon: List,
          action: () => editor.chain().focus().toggleBulletList().run(),
          active: editor.isActive("bulletList"),
          testId: "button-editor-bullet-list",
          title: "Bullet List",
        },
        {
          icon: ListOrdered,
          action: () => editor.chain().focus().toggleOrderedList().run(),
          active: editor.isActive("orderedList"),
          testId: "button-editor-ordered-list",
          title: "Ordered List",
        },
        {
          icon: Code,
          action: () => editor.chain().focus().toggleCodeBlock().run(),
          active: editor.isActive("codeBlock"),
          testId: "button-editor-code-block",
          title: "Code Block",
        },
        {
          icon: Quote,
          action: () => editor.chain().focus().toggleBlockquote().run(),
          active: editor.isActive("blockquote"),
          testId: "button-editor-blockquote",
          title: "Blockquote",
        },
      ],
    },
    {
      group: "insert",
      items: [
        {
          icon: Minus,
          action: () => editor.chain().focus().setHorizontalRule().run(),
          active: false,
          testId: "button-editor-hr",
          title: "Horizontal Rule",
        },
        {
          icon: Table,
          action: () =>
            editor
              .chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run(),
          active: false,
          testId: "button-editor-table",
          title: "Insert Table",
        },
        {
          icon: ImageIcon,
          action: () => {
            const url = window.prompt("Enter image URL:");
            if (url) {
              editor.chain().focus().setImage({ src: url }).run();
            }
          },
          active: false,
          disabled: false,
          testId: "button-editor-image",
          title: "Insert Image",
        },
      ],
    },
    {
      group: "math",
      items: [
        {
          icon: Sigma,
          action: () => {
            const latex = window.prompt("Enter LaTeX expression (inline):", "E = mc^2");
            if (latex) {
              editor.chain().focus().insertContent({
                type: "mathInline",
                attrs: { latex },
              }).run();
            }
          },
          active: false,
          disabled: false,
          testId: "button-editor-math-inline",
          title: "Inline Math",
        },
        {
          icon: SquareSigma,
          action: () => {
            const latex = window.prompt("Enter LaTeX expression (block):", "\\int_{a}^{b} f(x) \\, dx");
            if (latex) {
              editor.chain().focus().insertContent({
                type: "mathBlock",
                attrs: { latex },
              }).run();
            }
          },
          active: false,
          disabled: false,
          testId: "button-editor-math-block",
          title: "Block Math",
        },
      ],
    },
  ];

  return (
    <div
      className="flex items-center gap-0.5 flex-wrap border-b p-1.5 bg-muted/30 rounded-t-md sticky top-0 z-10"
      data-testid="editor-toolbar"
    >
      {tools.map((group, gi) => (
        <div key={group.group} className="flex items-center gap-0.5">
          {gi > 0 && <Separator orientation="vertical" className="mx-1 h-6" />}
          {group.items.map((tool) => (
            <Button
              key={tool.testId}
              size="icon"
              variant="ghost"
              onClick={tool.action}
              disabled={tool.disabled ?? false}
              className={`h-8 w-8 ${tool.active ? "bg-accent text-accent-foreground" : ""}`}
              data-testid={tool.testId}
              title={tool.title}
              type="button"
            >
              <tool.icon className="w-4 h-4" />
            </Button>
          ))}
        </div>
      ))}
    </div>
  );
}
