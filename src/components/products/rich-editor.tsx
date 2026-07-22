import { useEffect, useRef } from "react";
import { Bold, Italic, List, ListOrdered, Heading2 } from "lucide-react";

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export function RichEditor({ value, onChange, placeholder }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value;
    }
  }, [value]);

  const exec = (cmd: string, arg?: string) => {
    document.execCommand(cmd, false, arg);
    ref.current?.focus();
    if (ref.current) onChange(ref.current.innerHTML);
  };

  const tools = [
    { icon: Heading2, cmd: "formatBlock", arg: "H3", label: "Título" },
    { icon: Bold, cmd: "bold", label: "Negrito" },
    { icon: Italic, cmd: "italic", label: "Itálico" },
    { icon: List, cmd: "insertUnorderedList", label: "Lista" },
    { icon: ListOrdered, cmd: "insertOrderedList", label: "Lista numerada" },
  ];

  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface focus-within:border-foreground/40">
      <div className="flex items-center gap-0.5 border-b border-border bg-background/40 px-1.5 py-1">
        {tools.map((t) => (
          <button
            key={t.label}
            type="button"
            title={t.label}
            onMouseDown={(e) => {
              e.preventDefault();
              exec(t.cmd, t.arg);
            }}
            className="grid h-7 w-7 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <t.icon className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        ))}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
        className="min-h-[180px] px-4 py-3 text-[14px] leading-relaxed text-foreground outline-none [&:empty:before]:pointer-events-none [&:empty:before]:text-muted-foreground [&:empty:before]:content-[attr(data-placeholder)] [&_h3]:mt-2 [&_h3]:text-[15px] [&_h3]:font-medium [&_ol]:ml-5 [&_ol]:list-decimal [&_ul]:ml-5 [&_ul]:list-disc"
      />
    </div>
  );
}
