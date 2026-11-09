import type { ComponentProps } from "react";

const control = "w-full max-w-full rounded-control border border-control-border bg-surface px-3 py-2.5 text-ink caret-green placeholder:text-muted placeholder:opacity-100 disabled:bg-surface-subtle aria-invalid:border-error-border";

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return <input className={`${control} min-h-control ${className}`} {...props} />;
}

export function Select({ className = "", ...props }: ComponentProps<"select">) {
  return <select className={`${control} min-h-control ${className}`} {...props} />;
}

export function Textarea({ className = "", ...props }: ComponentProps<"textarea">) {
  return <textarea className={`${control} min-h-[100px] resize-y ${className}`} {...props} />;
}

export function Label({ layout = "field", className = "", ...props }: ComponentProps<"label"> & {
  layout?: "field" | "check";
}) {
  return <label className={`text-small font-bold ${layout === "check" ? "my-4 flex items-center gap-2.5" : "mb-1.5 block"} ${className}`} {...props} />;
}

export function Checkbox({ size = "regular", className = "", ...props }: Omit<ComponentProps<"input">, "type" | "size"> & {
  size?: "regular" | "attendance";
}) {
  return <input type="checkbox" className={`m-0 shrink-0 cursor-pointer accent-green aria-disabled:cursor-wait aria-disabled:opacity-60 ${size === "attendance" ? "size-[26px] min-h-[26px]" : "size-6 min-h-6"} ${className}`} {...props} />;
}

export function Fieldset({ className = "", ...props }: ComponentProps<"fieldset">) {
  return <fieldset className={`my-6 min-w-0 border-0 border-t border-line py-4 [&_legend]:font-bold ${className}`} {...props} />;
}
