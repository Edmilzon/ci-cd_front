"use client";

import { useState, type FormEvent } from "react";
import { ApiError, changePassword } from "@/src/lib/api";

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (newPassword !== confirmation) {
      setError("Las contraseñas nuevas no coinciden.");
      return;
    }
    setBusy(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword(""); setNewPassword(""); setConfirmation("");
      setNotice("Contraseña actualizada. Cerramos las demás sesiones de esta cuenta.");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "No pudimos actualizar la contraseña. Inténtalo otra vez.");
    } finally {
      setBusy(false);
    }
  }

  return <article className="panel password-panel"><div className="panel-heading"><div><h2>Seguridad de la cuenta</h2><p>Cambia tu contraseña y cierra las otras sesiones activas.</p></div><span className="password-mark">⌑</span></div>
    <form className="password-form" onSubmit={submit}>
      <label htmlFor="current-password">Contraseña actual</label><input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} minLength={1} maxLength={128} required disabled={busy}/>
      <label htmlFor="new-password">Nueva contraseña</label><input id="new-password" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={12} maxLength={128} required disabled={busy}/>
      <p>Usa al menos 12 caracteres y no reutilices una contraseña de otro servicio.</p>
      <label htmlFor="new-password-confirmation">Repite la contraseña nueva</label><input id="new-password-confirmation" type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} minLength={12} maxLength={128} required disabled={busy}/>
      {error && <div className="password-message password-error" role="alert">{error}</div>}{notice && <div className="password-message password-success" role="status">{notice}</div>}
      <button className="primary-button" disabled={busy}>{busy ? "Actualizando…" : "Actualizar contraseña"}</button>
    </form>
  </article>;
}
