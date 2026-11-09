import type { ComponentProps } from "react";

const variants = {
  primary: "border-transparent bg-green text-surface enabled:hover:brightness-93",
  secondary: "border-control-border bg-surface-subtle text-ink enabled:hover:brightness-93",
  text: "border-transparent bg-transparent text-muted enabled:hover:brightness-93",
  danger: "border-transparent bg-danger text-surface enabled:hover:brightness-93",
  "danger-secondary": "border-control-border bg-surface-subtle text-danger enabled:hover:brightness-93",
  "danger-text": "border-transparent bg-transparent text-danger enabled:hover:brightness-93",
  navigation: "border-transparent bg-transparent text-muted enabled:hover:bg-surface data-[active=true]:border-control-border data-[active=true]:bg-surface data-[active=true]:text-green",
  calendar: "border-transparent bg-surface text-ink enabled:hover:brightness-93 aria-pressed:bg-green aria-pressed:text-surface data-[today=true]:border-green",
  list: "border-transparent bg-transparent text-ink enabled:hover:brightness-93",
};

const sizes = {
  regular: "px-[18px] py-[11px]",
  calendarToggle: "px-3 py-[11px]",
  text: "px-[18px] py-[11px] text-small",
  icon: "min-w-11 p-2.5",
  calendarArrow: "min-w-10 p-1.5 text-[1.3rem]",
  calendarClose: "px-3 py-1 text-[1.4rem]",
  calendarDay: "w-full border-2 p-0.5",
  navigation: "flex-1 p-2.5 text-[.9375rem] [@media(width<=680px)]:basis-[calc(50%-2px)] [@media(width<=680px)]:px-1.5 [@media(width<=680px)]:text-small",
  list: "w-full rounded-lg px-2 py-5 text-left",
};

export type ButtonProps = ComponentProps<"button"> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
};

export function Button({ variant = "primary", size = "regular", type = "button", className = "", ...props }: ButtonProps) {
  return <button type={type} className={`min-h-control cursor-pointer border font-bold disabled:cursor-not-allowed disabled:opacity-48 ${size === "list" ? "" : "rounded-control"} ${variants[variant]} ${sizes[size]} ${className}`} {...props} />;
}

export function NavigationButton({ active, ...props }: Omit<ButtonProps, "variant" | "size"> & { active: boolean }) {
  return <Button variant="navigation" size="navigation" data-active={active} {...props} />;
}
