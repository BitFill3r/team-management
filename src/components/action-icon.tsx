export default function ActionIcon({ name }: { name: "left" | "right" | "close" }) {
  const paths = {
    left: "M15 6l-6 6 6 6",
    right: "M9 6l6 6-6 6",
    close: "M6 6l12 12M18 6L6 18",
  };
  return <svg className="size-5 align-middle" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d={paths[name]} />
  </svg>;
}
