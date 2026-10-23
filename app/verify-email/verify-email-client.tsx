"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError, confirmEmailVerification } from "@/src/lib/api";
import { ThemeSelector } from "@/src/ui/ThemeSelector";

export default function VerifyEmailClient({ token }: { token: string }) {
  const [state, setState] = useState<"checking" | "verified" | "error">(token ? "checking" : "error");
  const [message, setMessage] = useState(token ? "Estamos validando el enlace de tu correo…" : "El enlace está incompleto. Solicita un nuevo correo de verificación.");

  useEffect(() => {
    if (token) window.history.replaceState(window.history.state, "", "/verify-email");
    if (!token) return;
    let active = true;
    confirmEmailVerification(token).then(() => {
      if (active) { setState("verified"); setMessage("Correo verificado. Ya puedes iniciar sesión en CDCI."); }
    }).catch((cause: unknown) => {
      if (active) {
        setState("error");
        setMessage(cause instanceof ApiError ? cause.message : "No pudimos verificar el correo. Inténtalo otra vez.");
      }
    });
    return () => { active = false; };
  }, [token]);

  return <main className="auth-page">
    <ThemeSelector className="auth-theme-selector" />
    <section className="auth-card" aria-labelledby="verify-title">
      <Link className="auth-brand" href="/login" aria-label="CDCI, inicio de sesión"><span className="brand-symbol"><i /><i /><i /></span><span>cdci<span>.</span></span></Link>
      <p className="auth-eyebrow">VERIFICACIÓN DE CUENTA</p>
      <h1 id="verify-title">{state === "verified" ? "Correo confirmado" : state === "error" ? "No se pudo confirmar" : "Un momento…"}</h1>
      <p className={`password-message ${state === "error" ? "password-error" : state === "verified" ? "password-success" : ""}`} role={state === "error" ? "alert" : "status"}>{message}</p>
      {state === "verified" && <p className="auth-switch"><Link href="/login">Iniciar sesión</Link></p>}
      {state === "error" && <p className="auth-switch"><Link href="/register">Volver al registro</Link></p>}
    </section>
  </main>;
}
