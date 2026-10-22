"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  ApiError, confirmMfaSetup, disableMfa, getMfaStatus, regenerateMfaRecoveryCodes, startMfaSetup,
  type MfaSetup, type MfaStatus,
} from "@/src/lib/api";

export function MfaSettings() {
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [setup, setSetup] = useState<MfaSetup | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [rotationPassword, setRotationPassword] = useState("");
  const [rotationCode, setRotationCode] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try { setStatus(await getMfaStatus()); }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : "No se pudo consultar la autenticación MFA."); }
  }, []);

  useEffect(() => {
    let active = true;
    getMfaStatus()
      .then((value) => { if (active) setStatus(value); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof ApiError ? cause.message : "No se pudo consultar la autenticación MFA."); });
    return () => { active = false; };
  }, []);

  async function beginSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try { setSetup(await startMfaSetup(password)); setCode(""); }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : "No se pudo iniciar la configuración MFA."); }
    finally { setBusy(false); }
  }

  async function confirmSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const result = await confirmMfaSetup(code.trim());
      setRecoveryCodes(result.recoveryCodes); setSetup(null); setCode(""); setPassword("");
      await refresh();
    } catch (cause) { setError(cause instanceof ApiError ? cause.message : "No se pudo activar MFA."); }
    finally { setBusy(false); }
  }

  async function rotateCodes(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const result = await regenerateMfaRecoveryCodes(rotationPassword, rotationCode.trim());
      setRecoveryCodes(result.recoveryCodes); setRotationPassword(""); setRotationCode("");
      setNotice("Los códigos anteriores dejaron de funcionar."); await refresh();
    } catch (cause) { setError(cause instanceof ApiError ? cause.message : "No se pudieron regenerar los códigos."); }
    finally { setBusy(false); }
  }

  async function turnOff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      await disableMfa(disablePassword, disableCode.trim()); setSetup(null); setRecoveryCodes(null); setDisablePassword(""); setDisableCode("");
      setNotice("MFA quedó desactivada y se cerraron las demás sesiones."); await refresh();
    } catch (cause) { setError(cause instanceof ApiError ? cause.message : "No se pudo desactivar MFA."); }
    finally { setBusy(false); }
  }

  return <article className="panel settings-panel mfa-panel">
    <div className="panel-heading"><div><h2>Autenticación multifactor</h2><p>Protege el acceso con una app TOTP y códigos de recuperación.</p></div>
      <span className={`mfa-status ${status?.enabled ? "mfa-status-on" : ""}`}><i />{status?.enabled ? "Activa" : status ? "Inactiva" : "Consultando"}</span>
    </div>
    {error && <p className="password-message password-error" role="alert">{error}</p>}
    {notice && <p className="password-message password-success" role="status">{notice}</p>}
    {!status ? <p className="settings-help">Consultando el estado de seguridad…</p>
      : !status.available ? <div className="settings-info mfa-info"><span className="info-icon">!</span><p><strong>MFA no está disponible en este servidor.</strong><br />El administrador debe configurar <code>CDCI_MFA_ENCRYPTION_KEY</code>.</p></div>
      : setup ? <div className="mfa-enrollment">
        <p>Agrega CDCI a una app autenticadora con la clave TOTP. Esta clave se muestra solo durante la configuración.</p>
        <code className="mfa-secret">{setup.secret}</code>
        <a className="mfa-uri" href={setup.otpauthUri}>Abrir en una app compatible</a>
        <small>La configuración vence el {new Intl.DateTimeFormat("es-BO", { dateStyle: "short", timeStyle: "short", timeZone: "America/La_Paz" }).format(new Date(setup.expiresAt))}.</small>
        <form className="mfa-form" onSubmit={confirmSetup}>
          <label htmlFor="mfa-enrollment-code">Código de seis dígitos</label>
          <input id="mfa-enrollment-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} required />
          <button className="primary-button" type="submit" disabled={busy}>{busy ? "Activando…" : "Confirmar y activar MFA"}</button>
        </form>
      </div>
      : recoveryCodes ? <div className="mfa-recovery-block">
        <p><strong>Guarda estos códigos ahora.</strong> Cada uno sirve una sola vez y no volverán a mostrarse.</p>
        <ul className="mfa-code-list">{recoveryCodes.map((value) => <li key={value}><code>{value}</code></li>)}</ul>
        <button className="secondary-button" type="button" onClick={() => setRecoveryCodes(null)}>Ya guardé los códigos</button>
      </div>
      : status.enabled ? <div className="mfa-enabled-state">
        <div className="settings-info mfa-info"><span className="info-icon">✓</span><p><strong>Tu segundo factor está activo.</strong><br />Quedan {status.recoveryCodesRemaining} códigos de recuperación sin usar.</p></div>
        <div className="mfa-actions">
          <form className="mfa-form" onSubmit={rotateCodes}>
            <h3>Regenerar códigos</h3><p>Se invalidarán todos los códigos de recuperación anteriores.</p>
            <label htmlFor="mfa-rotate-password">Contraseña actual</label><input id="mfa-rotate-password" type="password" autoComplete="current-password" value={rotationPassword} onChange={(event) => setRotationPassword(event.target.value)} required />
            <label htmlFor="mfa-rotate-code">Código TOTP o de recuperación</label><input id="mfa-rotate-code" type="text" autoComplete="one-time-code" maxLength={64} value={rotationCode} onChange={(event) => setRotationCode(event.target.value)} required />
            <button className="secondary-button" type="submit" disabled={busy}>{busy ? "Regenerando…" : "Regenerar códigos"}</button>
          </form>
          <form className="mfa-form mfa-disable-form" onSubmit={turnOff}>
            <h3>Desactivar MFA</h3><p>Se requiere confirmar tu contraseña y un segundo factor válido.</p>
            <label htmlFor="mfa-disable-password">Contraseña actual</label><input id="mfa-disable-password" type="password" autoComplete="current-password" value={disablePassword} onChange={(event) => setDisablePassword(event.target.value)} required />
            <label htmlFor="mfa-disable-code">Código TOTP o de recuperación</label><input id="mfa-disable-code" type="text" autoComplete="one-time-code" maxLength={64} value={disableCode} onChange={(event) => setDisableCode(event.target.value)} required />
            <button className="secondary-button" type="submit" disabled={busy}>{busy ? "Desactivando…" : "Desactivar MFA"}</button>
          </form>
        </div>
      </div>
      : <form className="mfa-form" onSubmit={beginSetup}>
        <p>La activación requiere tu contraseña actual. Guarda los códigos de recuperación que CDCI mostrará una sola vez.</p>
        <label htmlFor="mfa-setup-password">Contraseña actual</label>
        <input id="mfa-setup-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        <button className="primary-button" type="submit" disabled={busy}>{busy ? "Preparando…" : "Configurar MFA"}</button>
      </form>}
  </article>;
}
