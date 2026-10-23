"use client";

import { useTheme, type Theme } from "@/src/ui/ThemeProvider";

const options: { value: Theme; label: string }[] = [
  { value: "day", label: "Día" },
  { value: "night", label: "Noche" },
];

function ThemeIcon({ theme }: { theme: Theme }) {
  const shared = {
    width: 15,
    height: 15,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  return theme === "day"
    ? <svg {...shared}><circle cx="12" cy="12" r="3.8" /><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></svg>
    : <svg {...shared}><path d="M20.2 15.1A8.6 8.6 0 0 1 8.9 3.8 8.7 8.7 0 1 0 20.2 15.1Z" /><path d="m16.5 4 .55 1.45L18.5 6l-1.45.55L16.5 8l-.55-1.45L14.5 6l1.45-.55L16.5 4Z" /></svg>;
}

export function ThemeSelector({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return <div className={`theme-selector ${className}`.trim()} role="group" aria-label="Tema de color">
    {options.map(({ value, label }) => <button
      key={value}
      type="button"
      className="theme-option"
      aria-label={`Modo ${label.toLowerCase()}`}
      aria-pressed={theme === value}
      onClick={() => setTheme(value)}
      title={`Modo ${label.toLowerCase()}`}
    ><ThemeIcon theme={value} /><span>{label}</span></button>)}
  </div>;
}
