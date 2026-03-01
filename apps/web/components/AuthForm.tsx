"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch, friendlyErrorMessage } from "../lib/api";
import { Eye, EyeOff, FileText } from "lucide-react";
import MapboxAddressAutocomplete from "./MapboxAddressAutocomplete";

type Mode = "login" | "register";

function flattenValidation(details: any): string | null {
  const fieldErrors = details?.fieldErrors as
    | Record<string, string[] | undefined>
    | undefined;
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
    acceptTerms: "términos y condiciones",
  };

  const errors = Object.entries(fieldErrors).flatMap(([key, arr]) =>
    (arr || []).map((msg) => {
      const f = labels[key] || key;
      const low = String(msg || "").toLowerCase();
      if (low.includes("required")) return `Falta completar ${f}.`;
      if (low.includes("must be accepted"))
        return "Debes aceptar términos y condiciones.";
      if (low.includes("invalid email")) return "El email no es válido.";
      if (low.includes("too small")) return `${f} es demasiado corto.`;
      if (low.includes("too big")) return `${f} es demasiado largo.`;
      if (low.includes("chileno") || low.includes("+56 9"))
        return "Por seguridad, solo aceptamos números chilenos válidos (+56 9...).";
      return `${f}: ${msg}`;
    }),
  );

  if (!errors.length) return null;
  return errors.join(" ");
}

export type RegisterFormData = {
  email: string;
  password: string;
  displayName: string;
  username: string;
  phone: string;
  gender?: string;
  primaryCategory?: string;
  profileType: string;
  preferenceGender?: string;
  address?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  acceptTerms: boolean;
  birthdate?: string;
  bio?: string;
};

export default function AuthForm({
  mode,
  initialProfileType,
  lockProfileType,
  termsAccepted: externalTermsAccepted,
  onOpenTerms,
  onSuccess,
  onCollectData,
}: {
  mode: Mode;
  initialProfileType?: string;
  lockProfileType?: boolean;
  termsAccepted?: boolean;
  onOpenTerms?: () => void;
  onSuccess?: (data: any) => { redirect?: string | null } | void;
  onCollectData?: (data: RegisterFormData) => void;
}) {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("FEMALE");
  const [birthdate, setBirthdate] = useState("");
  const [bio, setBio] = useState("");
  const [profileType, setProfileType] = useState(
    initialProfileType || "CLIENT",
  );
  const [preferenceGender, setPreferenceGender] = useState("ALL");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [latitude, setLatitude] = useState<string>("");
  const [longitude, setLongitude] = useState<string>("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [primaryCategory, setPrimaryCategory] = useState("");

  const isBusinessProfile =
    profileType === "PROFESSIONAL" ||
    profileType === "ESTABLISHMENT" ||
    profileType === "SHOP";
  const phoneRegex = /^\+56\s?9(?:[\s-]?\d){8}$/;

  const finalTermsAccepted = externalTermsAccepted ?? acceptTerms;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === "register") {
        if (!finalTermsAccepted) {
          setError("Debes aceptar los términos y condiciones para continuar.");
          setLoading(false);
          return;
        }
        if (!phoneRegex.test(phone.trim())) {
          setError(
            "Por seguridad, solo aceptamos números chilenos válidos (+56 9...)",
          );
          setLoading(false);
          return;
        }
        if (
          isBusinessProfile &&
          (!Number.isFinite(Number(latitude)) ||
            !Number.isFinite(Number(longitude)))
        ) {
          setError(
            "Debes seleccionar una dirección válida desde el buscador de Mapbox.",
          );
          setLoading(false);
          return;
        }

        const formData: RegisterFormData = {
          email,
          password,
          displayName,
          username,
          phone,
          gender: profileType === "PROFESSIONAL" ? gender : undefined,
          primaryCategory: profileType === "PROFESSIONAL" ? (primaryCategory || undefined) : undefined,
          profileType,
          preferenceGender:
            profileType === "CLIENT" ? preferenceGender : undefined,
          address: isBusinessProfile ? address : undefined,
          city: isBusinessProfile ? city || undefined : undefined,
          latitude: isBusinessProfile ? Number(latitude) : undefined,
          longitude: isBusinessProfile ? Number(longitude) : undefined,
          acceptTerms: finalTermsAccepted,
          birthdate: birthdate || undefined,
          bio: bio || undefined,
        };

        // If onCollectData is provided, defer registration (verify-first flow)
        if (onCollectData) {
          onCollectData(formData);
          setLoading(false);
          return;
        }

        const res = await apiFetch("/auth/register", {
          method: "POST",
          body: JSON.stringify(formData),
        });
        const override = onSuccess?.(res);
        const next = searchParams.get("next");
        const redirectTo =
          override && "redirect" in override ? override.redirect : next || "/";
        if (redirectTo) window.location.replace(redirectTo);
        return;
      } else {
        await apiFetch("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
      }
      const next = searchParams.get("next");
      window.location.replace(next || "/");
    } catch (err: any) {
      const detailed = err?.body?.details
        ? flattenValidation(err.body.details)
        : null;
      setError(detailed || friendlyErrorMessage(err) || "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      {mode === "register" ? (
        <div className="grid gap-2">
          <label className="text-sm font-medium text-white/70">Nombre público</label>
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
          <label className="text-sm font-medium text-white/70">Nombre de usuario</label>
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
        <label className="text-sm font-medium text-white/70">Email</label>
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
          <label className="text-sm font-medium text-white/70">Teléfono</label>
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
          <label className="text-sm font-medium text-white/70">Género</label>
          <div className="relative">
            <select
              className="input select-dark"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
            >
              <option value="FEMALE">Mujer</option>
              <option value="MALE">Hombre</option>
              <option value="OTHER">Otro</option>
            </select>
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-white/40">
              ▾
            </span>
          </div>
        </div>
      ) : null}

      {mode === "register" && !lockProfileType ? (
        <div className="grid gap-2">
          <label className="text-sm font-medium text-white/70">Tipo de perfil</label>
          <div className="relative">
            <select
              className="input select-dark"
              value={profileType}
              onChange={(e) => setProfileType(e.target.value)}
            >
              <option value="CLIENT">Cliente</option>
              <option value="PROFESSIONAL">Experiencia</option>
              <option value="ESTABLISHMENT">Lugar</option>
              <option value="SHOP">Tienda</option>
            </select>
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-white/40">
              ▾
            </span>
          </div>
        </div>
      ) : null}

      {mode === "register" && profileType === "CLIENT" ? (
        <div className="grid gap-2">
          <label className="text-sm font-medium text-white/70">Preferencia de género</label>
          <div className="relative">
            <select
              className="input select-dark"
              value={preferenceGender}
              onChange={(e) => setPreferenceGender(e.target.value)}
            >
              <option value="ALL">Todos</option>
              <option value="FEMALE">Mujer</option>
              <option value="MALE">Hombre</option>
              <option value="OTHER">Otro</option>
            </select>
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-white/40">
              ▾
            </span>
          </div>
        </div>
      ) : null}

      {mode === "register" && profileType === "PROFESSIONAL" ? (
        <div className="grid gap-2">
          <label className="text-sm font-medium text-white/70">Fecha de nacimiento</label>
          <input
            className="input"
            value={birthdate}
            onChange={(e) => setBirthdate(e.target.value)}
            type="date"
            required
            max={new Date().toISOString().split("T")[0]}
          />
          <p className="text-xs text-white/40">Debes ser mayor de 18 años.</p>
        </div>
      ) : null}

      {mode === "register" && profileType === "PROFESSIONAL" ? (
        <div className="grid gap-2">
          <label className="text-sm font-medium text-white/70">¿Cómo te defines? (categoría principal)</label>
          <div className="relative">
            <select
              className="input appearance-none pr-10"
              value={primaryCategory}
              onChange={(e) => setPrimaryCategory(e.target.value)}
            >
              <option value="">Selecciona tu categoría</option>
              <option value="escort">Escort / Acompañante</option>
              <option value="masajes">Masajista</option>
              <option value="trans">Trans</option>
              <option value="despedidas">Despedidas de soltero</option>
              <option value="videollamadas">Videollamadas</option>
            </select>
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-white/40">▾</span>
          </div>
        </div>
      ) : null}

      {mode === "register" &&
      (profileType === "PROFESSIONAL" ||
        profileType === "ESTABLISHMENT" ||
        profileType === "SHOP") ? (
        <div className="grid gap-2">
          <label className="text-sm font-medium text-white/70">
            {profileType === "PROFESSIONAL"
              ? "Descripción del perfil"
              : "Descripción comercial"}
          </label>
          <textarea
            className="input min-h-[110px]"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder={
              profileType === "PROFESSIONAL"
                ? "Describe tu experiencia en pocas líneas."
                : "Describe tu negocio (opcional)."
            }
            required={profileType === "PROFESSIONAL"}
          />
        </div>
      ) : null}

      {mode === "register" && isBusinessProfile ? (
        <>
          <MapboxAddressAutocomplete
            label="Dirección"
            value={address}
            onChange={(next) => {
              setAddress(next);
              setLatitude("");
              setLongitude("");
            }}
            onSelect={(selection) => {
              setAddress(selection.placeName);
              setCity(selection.city || "");
              setLatitude(String(selection.latitude));
              setLongitude(String(selection.longitude));
            }}
            placeholder="Busca tu dirección"
            required
          />
          <p className="text-xs text-white/40">
            Para publicar perfiles comerciales debes validar la dirección con
            Mapbox.
          </p>
        </>
      ) : null}

      <div className="grid gap-2">
        <label className="text-sm font-medium text-white/70">Contraseña</label>
        <div className="relative">
          <input
            className="input pr-12"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type={showPassword ? "text" : "password"}
            required
            minLength={8}
            placeholder="Mínimo 8 caracteres"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition p-1"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {mode === "register" ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 h-5 w-5 rounded border-white/20 bg-white/5 accent-fuchsia-500"
              checked={finalTermsAccepted}
              onChange={(e) => {
                if (onOpenTerms && !finalTermsAccepted) {
                  onOpenTerms();
                } else {
                  setAcceptTerms(e.target.checked);
                }
              }}
              required
            />
            <span className="text-sm text-white/60 leading-relaxed">
              He leído y acepto los{" "}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  if (onOpenTerms) {
                    onOpenTerms();
                  }
                }}
                className="inline-flex items-center gap-1 text-fuchsia-300/80 hover:text-fuchsia-300 underline underline-offset-2 transition"
              >
                <FileText className="h-3 w-3" />
                Términos y Condiciones
              </button>
              {" "}de la plataforma.
            </span>
          </label>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <button
        disabled={loading}
        className="btn-primary w-full py-3.5 text-base flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {loading ? (
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : mode === "register" ? (
          "Crear cuenta"
        ) : (
          "Ingresar"
        )}
      </button>
    </form>
  );
}
