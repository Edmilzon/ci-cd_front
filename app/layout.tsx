import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import "./auth.css";
import "./admin.css";
import "./projects.css";
import "./liquid-glass.css";
import { AuthProvider } from "@/src/auth/AuthProvider";
import { ThemeProvider } from "@/src/ui/ThemeProvider";

const themeBootstrapScript = `try { const theme = localStorage.getItem("cdci.theme"); document.documentElement.dataset.theme = theme === "day" ? "day" : "night"; } catch { document.documentElement.dataset.theme = "night"; }`;

export const metadata: Metadata = {
  title: "CDCI | Plataforma CI/CD",
  description: "Pipelines y despliegues de tu equipo en un solo lugar.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" data-theme="night" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} /></head>
      <body><Suspense fallback={<div className="auth-loading" role="status">Cargando CDCI…</div>}><ThemeProvider><AuthProvider>{children}</AuthProvider></ThemeProvider></Suspense></body>
    </html>
  );
}
