"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/src/auth/AuthProvider";
import { ApiError, login } from "@/src/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email.trim(), password);
      await refresh();
      router.replace("/");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "No pudimos conectar con CDCI. Revisa el backend e inténtalo otra vez.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-page">
    <section className="auth-card" aria-labelledby="login-title">
      <Link className="auth-brand" href="/" aria-label="CDCI, inicio"><span className="brand-symbol"><i /><i /><i /></span><span>cdci<span>.</span></span></Link>
      <p className="auth-eyebrow">PLATAFORMA CI/CD</p>
      <h1 id="login-title">Qué bueno verte</h1>
      <p className="auth-description">Inicia sesión para entrar a tu espacio de trabajo.</p>
      <form className="auth-form" onSubmit={submit}>
        <label htmlFor="email">Correo electrónico</label>
        <input id="email" name="email" type="email" autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@empresa.com" required />
        <label htmlFor="password">Contraseña</label>
        <input id="password" name="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Tu contraseña" required />
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="auth-submit" type="submit" disabled={busy}>{busy ? "Iniciando sesión…" : "Iniciar sesión"}</button>
      </form>
      <p className="auth-switch">¿Todavía no tienes cuenta? <Link href="/register">Crear una cuenta</Link></p>
      <p className="auth-security"><span aria-hidden="true">⌑</span> Tu sesión se protege con una cookie segura.</p>
    </section>
  </main>;
}
