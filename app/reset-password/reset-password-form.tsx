"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { ApiError, resetPassword } from "@/src/lib/api";

export default function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    if (token) window.history.replaceState(window.history.state, "", "/reset-password");
  }, [token]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password !== confirmation) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    try {
      await resetPassword(token, password);
      setComplete(true);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "No pudimos actualizar la contraseña. Inténtalo otra vez.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-page">
    <section className="auth-card" aria-labelledby="reset-title">
      <Link className="auth-brand" href="/login" aria-label="CDCI, inicio de sesión"><span className="brand-symbol"><i /><i /><i /></span><span>cdci<span>.</span></span></Link>
      <p className="auth-eyebrow">SEGURIDAD DE LA CUENTA</p>
      <h1 id="reset-title">Elige una contraseña nueva</h1>
      <p className="auth-description">Usa una contraseña única de al menos 12 caracteres. Al terminar, se cerrarán tus sesiones activas.</p>
      {!token ? <div className="password-message password-error" role="alert">El enlace está incompleto. Solicita uno nuevo para continuar.</div> : complete ?
        <div className="password-message password-success" role="status">Contraseña actualizada. <Link href="/login">Inicia sesión</Link> con tu contraseña nueva.</div> :
        <form className="auth-form" onSubmit={submit}>
          <label htmlFor="password">Contraseña nueva</label>
          <input id="password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} required disabled={busy} />
          <label htmlFor="confirmation">Repite la contraseña</label>
          <input id="confirmation" name="confirmation" type="password" autoComplete="new-password" minLength={12} maxLength={128} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required disabled={busy} />
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" type="submit" disabled={busy}>{busy ? "Guardando…" : "Actualizar contraseña"}</button>
        </form>}
      <p className="auth-switch"><Link href="/forgot-password">Solicitar otro enlace</Link></p>
    </section>
  </main>;
}
