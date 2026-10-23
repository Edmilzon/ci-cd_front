"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/src/auth/AuthProvider";
import { ApiError, completeMfaLogin, confirmMfaSetup, login, startMfaSetup, type MfaSetup } from "@/src/lib/api";
import { ThemeSelector } from "@/src/ui/ThemeSelector";

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"password" | "mfa" | "setup">("password");
  const [challenge, setChallenge] = useState("");
  const [enrollment, setEnrollment] = useState<MfaSetup | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  async function enterWorkspace() {
    await refresh();
    router.replace("/");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = await login(email.trim(), password);
      if (result.mfaRequired) {
        setStep(result.mfaSetupRequired ? "setup" : "mfa");
        if (result.mfaSetupRequired) setEnrollment(await startMfaSetup(password));
        return;
      }
      await enterWorkspace();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "No pudimos conectar con CDCI. Revisa el backend e inténtalo otra vez.");
    } finally {
      setBusy(false);
    }
  }

  async function submitMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    try { await completeMfaLogin(challenge.trim()); await enterWorkspace(); }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : "No pudimos validar el código."); }
    finally { setBusy(false); }
  }

  async function submitSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    try { setRecoveryCodes((await confirmMfaSetup(challenge.trim())).recoveryCodes); }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : "No pudimos activar MFA."); }
    finally { setBusy(false); }
  }

  async function retryEnrollment() {
    setError(""); setBusy(true);
    try { setEnrollment(await startMfaSetup(password)); }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : "No pudimos iniciar la configuración MFA."); }
    finally { setBusy(false); }
  }

  return <main className="auth-page">
    <ThemeSelector className="auth-theme-selector" />
    <section className="auth-card" aria-labelledby="login-title">
      <Link className="auth-brand" href="/" aria-label="CDCI, inicio"><span className="brand-symbol"><i /><i /><i /></span><span>cdci<span>.</span></span></Link>
      <p className="auth-eyebrow">PLATAFORMA CI/CD</p>
      <h1 id="login-title">{recoveryCodes ? "Guarda tus códigos" : step === "mfa" ? "Verifica tu identidad" : step === "setup" ? "Protege tu cuenta" : "Qué bueno verte"}</h1>
      <p className="auth-description">{recoveryCodes ? "Cada código se puede utilizar una sola vez. Guárdalos en un lugar seguro." : step === "mfa" ? "Ingresa el código de tu app autenticadora o un código de recuperación." : step === "setup" ? "Esta instalación requiere MFA. Configura una app autenticadora para continuar." : "Inicia sesión para entrar a tu espacio de trabajo."}</p>
      {step === "password" && <form className="auth-form" onSubmit={submit}>
        <label htmlFor="email">Correo electrónico</label>
        <input id="email" name="email" type="email" autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@empresa.com" required />
        <label htmlFor="password">Contraseña</label>
        <input id="password" name="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Tu contraseña" required />
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="auth-submit" type="submit" disabled={busy}>{busy ? "Iniciando sesión…" : "Iniciar sesión"}</button>
      </form>}
      {step === "mfa" && <form className="auth-form" onSubmit={submitMfa}>
        <label htmlFor="mfa-code">Código de verificación o recuperación</label>
        <input id="mfa-code" name="mfa-code" type="text" inputMode="text" autoComplete="one-time-code" autoFocus maxLength={64} value={challenge} onChange={(event) => setChallenge(event.target.value)} placeholder="123456 o A1B2-C3D4" required />
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="auth-submit" type="submit" disabled={busy}>{busy ? "Verificando…" : "Verificar e iniciar sesión"}</button>
        <button className="auth-back-button" type="button" onClick={() => { setStep("password"); setChallenge(""); setError(""); }}>Volver al inicio de sesión</button>
      </form>}
      {step === "setup" && !recoveryCodes && <div className="auth-mfa-setup">
        {enrollment ? <>
          <p>Agrega esta cuenta a tu app autenticadora con el secreto TOTP:</p>
          <code className="auth-mfa-secret">{enrollment.secret}</code>
          <a className="auth-mfa-uri" href={enrollment.otpauthUri}>Abrir en app autenticadora compatible</a>
          <form className="auth-form" onSubmit={submitSetup}>
            <label htmlFor="setup-code">Código de seis dígitos</label>
            <input id="setup-code" name="setup-code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={challenge} onChange={(event) => setChallenge(event.target.value.replace(/\D/g, ""))} placeholder="123456" required />
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="auth-submit" type="submit" disabled={busy}>{busy ? "Activando…" : "Activar MFA"}</button>
          </form>
        </> : <>
          <p>Prepara una app autenticadora. La clave de cifrado del servidor es necesaria para proteger el secreto.</p>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" type="button" onClick={() => void retryEnrollment()} disabled={busy}>{busy ? "Preparando…" : "Preparar autenticación MFA"}</button>
        </>}
      </div>}
      {recoveryCodes && <div className="auth-recovery-codes"><p>Los códigos solo se muestran ahora. Cada código permite recuperar un acceso.</p><ul>{recoveryCodes.map((code) => <li key={code}><code>{code}</code></li>)}</ul><button className="auth-submit" type="button" onClick={() => void enterWorkspace()}>Ya los guardé, continuar</button></div>}
      <p className="auth-switch auth-recovery"><Link href="/forgot-password">¿Olvidaste tu contraseña?</Link></p>
      <p className="auth-switch">¿Todavía no tienes cuenta? <Link href="/register">Crear una cuenta</Link></p>
      <p className="auth-security"><span aria-hidden="true">⌑</span> Tu sesión se protege con una cookie segura.</p>
    </section>
  </main>;
}
