import type { Metadata } from "next";
import "./globals.css";
import "./auth.css";
import "./admin.css";
import { AuthProvider } from "@/src/auth/AuthProvider";

export const metadata: Metadata = {
  title: "CDCI | Plataforma CI/CD",
  description: "Pipelines y despliegues de tu equipo en un solo lugar.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es">
      <body><AuthProvider>{children}</AuthProvider></body>
    </html>
  );
}
