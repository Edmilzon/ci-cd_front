"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { ApiError, getPasswordResetStatus, requestPasswordReset } from "@/src/lib/api";
import { ThemeSelector } from "@/src/ui/ThemeSelector";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    getPasswordResetStatus().then((status) => { if (active) setAvailable(status.enabled); }).catch(() => { if (active) setAvailable(null); });
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "No pudimos conectar con CDCI. Inténtalo otra vez.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-page">
    <ThemeSelector className="auth-theme-selector" />
    <section className="auth-card" aria-labelledby="forgot-title">
      <Link className="auth-brand" href="/login" aria-label="CDCI, inicio de sesión"><span className="brand-symbol"><i /><i /><i /></span><span>cdci<span>.</span></span></Link>
      <p className="auth-eyebrow">RECUPERA TU ACCESO</p>
      <h1 id="forgot-title">Restablece tu contraseña</h1>
      <p className="auth-description">Indica el correo de tu cuenta y te enviaremos un enlace seguro de un solo uso.</p>
      {available === false ? <div className="password-message" role="status">La recuperación por correo no está habilitada en este momento. Contacta al administrador de CDCI.</div> : sent ? <div className="password-message password-success" role="status">Si la cuenta existe, recibirás instrucciones para restablecer la contraseña. Revisa tu correo.</div> :
        <form className="auth-form" onSubmit={submit}>
          <label htmlFor="email">Correo electrónico</label>
          <input id="email" name="email" type="email" autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@empresa.com" required disabled={busy} />
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" type="submit" disabled={busy}>{busy ? "Enviando…" : "Enviar enlace"}</button>
        </form>}
      <p className="auth-switch"><Link href="/login">Volver a iniciar sesión</Link></p>
      <p className="auth-security"><span aria-hidden="true">⌑</span> El enlace es temporal y solo se puede usar una vez.</p>
    </section>
  </main>;
}
