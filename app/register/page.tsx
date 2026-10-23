"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ApiError, getRegistrationStatus, registerAccount, requestEmailVerification } from "@/src/lib/api";
import { ThemeSelector } from "@/src/ui/ThemeSelector";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendNotice, setResendNotice] = useState("");
  const [registrationEnabled, setRegistrationEnabled] = useState<boolean | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState("");

  useEffect(() => {
    let active = true;
    getRegistrationStatus().then((status) => {
      if (active) setRegistrationEnabled(status.enabled);
    }).catch(() => {
      if (active) setStatusError("No pudimos comprobar si el registro está disponible.");
    }).finally(() => {
      if (active) setStatusLoading(false);
    });
    return () => { active = false; };
  }, []);

  async function retryRegistrationStatus() {
    setStatusError("");
    setStatusLoading(true);
    try {
      const status = await getRegistrationStatus();
      setRegistrationEnabled(status.enabled);
    } catch {
      setStatusError("No pudimos comprobar si el registro está disponible.");
    } finally {
      setStatusLoading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password !== confirmation) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    try {
      const account = await registerAccount({ email: email.trim(), fullName: fullName.trim(), password });
      if (account.verificationRequired && !account.emailVerified) setPendingVerification(true);
      else router.replace("/login?registered=1");
    } catch (cause) {
      const validation = cause instanceof ApiError ? Object.values(cause.fields ?? {})[0] : undefined;
      setError(validation ?? (cause instanceof ApiError ? cause.message : "No pudimos crear la cuenta. Revisa el backend e inténtalo otra vez."));
    } finally {
      setBusy(false);
    }
  }

  async function resendVerification() {
    setResendNotice("");
    setResendBusy(true);
    try {
      await requestEmailVerification(email.trim());
      setResendNotice("Si la cuenta está pendiente de verificación, recibirás otro correo con los siguientes pasos.");
    } catch {
      setResendNotice("No pudimos enviar el correo ahora. Inténtalo de nuevo más tarde.");
    } finally {
      setResendBusy(false);
    }
  }

  return <main className="auth-page">
    <ThemeSelector className="auth-theme-selector" />
    <section className="auth-card" aria-labelledby="register-title">
      <Link className="auth-brand" href="/" aria-label="CDCI, inicio"><span className="brand-symbol"><i /><i /><i /></span><span>cdci<span>.</span></span></Link>
      <p className="auth-eyebrow">EMPIEZA CON CDCI</p>
      <h1 id="register-title">{registrationEnabled === false ? "Registro deshabilitado" : pendingVerification ? "Revisa tu correo" : "Crea tu cuenta"}</h1>
      <p className="auth-description">Un espacio para coordinar las entregas de tu equipo.</p>
      {statusLoading ? <p className="auth-hint" role="status">Comprobando si el registro está disponible…</p>
        : statusError ? <div className="verification-pending">
          <p className="auth-error" role="alert">{statusError}</p>
          <button className="auth-submit" type="button" onClick={retryRegistrationStatus}>Reintentar</button>
        </div>
        : registrationEnabled === false ? <div className="verification-pending">
          <p className="password-message" role="status">El registro de cuentas nuevas está cerrado en esta instalación. Solicita acceso a una persona administradora.</p>
        </div>
        : pendingVerification ? <div className="verification-pending">
        <div className="password-message password-success" role="status">Te enviamos un enlace de verificación a <strong>{email.trim()}</strong>. Confirma el correo antes de iniciar sesión.</div>
        <button className="auth-submit" type="button" onClick={resendVerification} disabled={resendBusy}>{resendBusy ? "Enviando…" : "Reenviar correo de verificación"}</button>
        {resendNotice && <p className="auth-hint" role="status">{resendNotice}</p>}
      </div> : <form className="auth-form" onSubmit={submit}>
        <label htmlFor="fullName">Nombre completo</label>
        <input id="fullName" name="fullName" autoComplete="name" minLength={2} maxLength={80} value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Cómo te llamas" required />
        <label htmlFor="email">Correo electrónico</label>
        <input id="email" name="email" type="email" autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@empresa.com" required />
        <label htmlFor="password">Contraseña</label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Al menos 12 caracteres" required />
        <label htmlFor="confirmation">Repite tu contraseña</label>
        <input id="confirmation" name="confirmation" type="password" autoComplete="new-password" minLength={12} maxLength={128} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Escríbela otra vez" required />
        <p className="auth-hint">Usa una frase larga que no compartas con otros servicios.</p>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="auth-submit" type="submit" disabled={busy}>{busy ? "Creando cuenta…" : "Crear cuenta"}</button>
      </form>}
      <p className="auth-switch">¿Ya tienes cuenta? <Link href="/login">Iniciar sesión</Link></p>
      <p className="auth-security"><span aria-hidden="true">⌑</span> Las nuevas cuentas empiezan con acceso de lectura.</p>
    </section>
  </main>;
}
