import type { ComponentProps, ComponentPropsWithoutRef } from "react";

export function Panel({ as: Element = "section", padding = "regular", className = "", ...props }: ComponentPropsWithoutRef<"section"> & {
  as?: "section" | "div";
  padding?: "regular" | "login";
}) {
  const spacing = padding === "login"
    ? "p-9 [@media(width<=680px)]:p-7"
    : "p-8 [@media(width<=680px)]:px-4 [@media(width<=680px)]:py-6";
  return <Element className={`rounded-panel border border-line bg-surface ${spacing} ${className}`} {...props} />;
}

export function SectionHeading({ className = "", ...props }: ComponentProps<"div">) {
  return <div className={`mb-4 flex items-center justify-between gap-5 border-b border-line pb-4 [@media(width<=680px)]:flex-wrap [@media(width<=680px)]:items-start [@media(width<=680px)]:gap-4 ${className}`} {...props} />;
}

export function NavigationGroup({ as: Element = "div", className = "", ...props }: ComponentProps<"div"> & {
  as?: "div" | "nav";
}) {
  return <Element className={`flex gap-1 rounded-control border border-line bg-surface-subtle p-1 [@media(width<=680px)]:flex-wrap ${className}`} {...props} />;
}
