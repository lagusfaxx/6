"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch, friendlyErrorMessage } from "../lib/api";

type Mode = "login" | "register";

function flattenValidation(details: any): string | null {
  const fieldErrors = details?.fieldErrors as Record<string, string[] | undefined> | undefined;
  if (!fieldErrors) return null;

  const labels: Record<string, string> = {
    username: "nombre de usuario",
    phone: "teléfono",
    email: "email",
    password: "contraseña",
    displayName: "nombre público",
    gender: "género",
    birthdate: "edad",
    bio: "descripción",
    profileType: "tipo de perfil",
    preferenceGender: "preferencia de género",
    address: "dirección",
    acceptTerms: "términos y condiciones"
  };

  const errors = Object.entries(fieldErrors)
    .flatMap(([key, arr]) => (arr || []).map((msg) => {
      const f = labels[key] || key;
      const low = String(msg || "").toLowerCase();
      if (low.includes("required")) return `Falta completar ${f}.`;
      if (low.includes("must be accepted")) return "Debes aceptar términos y condiciones.";
      if (low.includes("invalid email")) return "El email no es válido.";
      if (low.includes("too small")) return `${f} es demasiado corto.`;
      if (low.includes("too big")) return `${f} es demasiado largo.`;
      return `${f}: ${msg}`;
    }));

  if (!errors.length) return null;
  return errors.join(" ");
}

export default function AuthForm({
  mode,
  initialProfileType,
  lockProfileType,
  onSuccess
}: {
  mode: Mode;
  initialProfileType?: string;
  lockProfileType?: boolean;
  onSuccess?: (data: any) => { redirect?: string | null } | void;
}) {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("FEMALE");
  const [birthdate, setBirthdate] = useState("");
  const [bio, setBio] = useState("");
  const [profileType, setProfileType] = useState(initialProfileType || "CLIENT");
  const [preferenceGender, setPreferenceGender] = useState("ALL");
  const [address, setAddress] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === "register") {
        const res = await apiFetch("/auth/register", {
          method: "POST",
          body: JSON.stringify({
            email,
            password,
            displayName,
            username,
            phone,
            gender: profileType === "PROFESSIONAL" ? gender : undefined,
            profileType,
            preferenceGender: profileType === "CLIENT" ? preferenceGender : undefined,
            address,
            acceptTerms,
            birthdate: birthdate || undefined,
            bio: bio || undefined
          })
        });
        const override = onSuccess?.(res);
        const next = searchParams.get("next");
        const redirectTo = override && "redirect" in override ? override.redirect : next || "/";
        if (redirectTo) window.location.replace(redirectTo);
        return;
      } else {
        await apiFetch("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password })
        });
      }
      const next = searchParams.get("next");
      window.location.replace(next || "/");
    } catch (err: any) {
      const detailed = err?.body?.details ? flattenValidation(err.body.details) : null;
      setError(detailed || friendlyErrorMessage(err) || "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      {mode === "register" ? (
        <div className="grid gap-2">
          <label className="text-sm text-white/70">Nombre público</label>
          <input
            className="input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Ej: Agus"
            required
            minLength={2}
          />
        </div>
      ) : null}

      {mode === "register" ? (
        <div className="grid gap-2">
          <label className="text-sm text-white/70">Nombre de usuario</label>
          <input
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="tuusuario"
            required
            minLength={3}
          />
        </div>
      ) : null}

      <div className="grid gap-2">
        <label className="text-sm text-white/70">Email</label>
        <input
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@email.com"
          type="email"
          required
        />
      </div>

      {mode === "register" ? (
        <div className="grid gap-2">
          <label className="text-sm text-white/70">Teléfono</label>
          <input
            className="input"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+56 9 1234 5678"
            required
          />
        </div>
      ) : null}

      {mode === "register" && profileType === "PROFESSIONAL" ? (
        <div className="grid gap-2">
          <label className="text-sm text-white/70">Género</label>
          <div className="relative">
            <select className="input select-dark" value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="FEMALE">Mujer</option>
              <option value="MALE">Hombre</option>
              <option value="OTHER">Otro</option>
            </select>
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-white/40">▾</span>
          </div>
        </div>
      ) : null}

      {mode === "register" && !lockProfileType ? (
        <div className="grid gap-2">
          <label className="text-sm text-white/70">Tipo de perfil</label>
          <div className="relative">
            <select className="input select-dark" value={profileType} onChange={(e) => setProfileType(e.target.value)}>
              <option value="CLIENT">Cliente</option>
              <option value="PROFESSIONAL">Experiencia</option>
              <option value="ESTABLISHMENT">Lugar</option>
              <option value="SHOP">Tienda</option>
            </select>
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-white/40">▾</span>
          </div>
        </div>
      ) : null}

      {mode === "register" && profileType === "CLIENT" ? (
        <div className="grid gap-2">
          <label className="text-sm text-white/70">Preferencia de género</label>
          <div className="relative">
            <select className="input select-dark" value={preferenceGender} onChange={(e) => setPreferenceGender(e.target.value)}>
              <option value="ALL">Todos</option>
              <option value="FEMALE">Mujer</option>
              <option value="MALE">Hombre</option>
              <option value="OTHER">Otro</option>
            </select>
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-white/40">▾</span>
          </div>
        </div>
      ) : null}

      {mode === "register" && profileType === "PROFESSIONAL" ? (
        <div className="grid gap-2">
          <label className="text-sm text-white/70">Fecha de nacimiento</label>
          <input
            className="input"
            value={birthdate}
            onChange={(e) => setBirthdate(e.target.value)}
            type="date"
            required
            max={new Date().toISOString().split("T")[0]}
          />
          <p className="text-xs text-white/50">Debes ser mayor de 18 años.</p>
        </div>
      ) : null}

      {mode === "register" && (profileType === "PROFESSIONAL" || profileType === "ESTABLISHMENT" || profileType === "SHOP") ? (
        <div className="grid gap-2">
          <label className="text-sm text-white/70">
            {profileType === "PROFESSIONAL" ? "Descripción del perfil" : "Descripción comercial"}
          </label>
          <textarea
            className="input min-h-[110px]"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder={profileType === "PROFESSIONAL" ? "Describe tu experiencia en pocas líneas." : "Describe tu negocio (opcional)."}
            required={profileType === "PROFESSIONAL"}
          />
        </div>
      ) : null}

      {mode === "register" ? (
        <div className="grid gap-2">
          <label className="text-sm text-white/70">Dirección</label>
          <input
            className="input"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Av. Providencia 1234, Santiago"
            required
          />
          <p className="text-xs text-white/50">Se usa para el mapa de servicios y cercanía.</p>
        </div>
      ) : null}

      <div className="grid gap-2">
        <label className="text-sm text-white/70">Contraseña</label>
        <input
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          required
          minLength={8}
        />
        <p className="text-xs text-white/50">Mínimo 8 caracteres.</p>
      </div>

      {mode === "register" ? (
        <label className="flex items-start gap-3 text-xs text-white/60">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4"
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            required
          />
          <span>
            Acepto los términos y condiciones y entiendo los descargos legales de la plataforma.
          </span>
        </label>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <button disabled={loading} className="btn-primary">
        {loading ? "Procesando..." : mode === "register" ? "Crear cuenta" : "Ingresar"}
      </button>
    </form>
  );
}
