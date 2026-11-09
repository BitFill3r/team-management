import type { ComponentProps } from "react";

export function ErrorMessage({ as: Element = "div", className = "", ...props }: ComponentProps<"div"> & {
  as?: "div" | "p";
}) {
  return <Element role="alert" data-ui="error" className={`rounded-control border border-error-border bg-error-bg px-4 py-3 text-[.9375rem] text-error-text ${className}`} {...props} />;
}
