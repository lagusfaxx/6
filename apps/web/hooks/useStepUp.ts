"use client";

import { useCallback, useState } from "react";
import { ApiHttpError, apiFetch } from "../lib/api";

// ─────────────────────────────────────────────────────────────────────────
// useStepUp: wraps an arbitrary apiFetch call and, if the backend rejects
// it with STEP_UP_REQUIRED, prompts the user for a fresh Google
// Authenticator code, posts it to /auth/2fa/verify, and retries the
// original action exactly once. If the backend rejects with TOTP_REQUIRED
// (the user has not enrolled 2FA at all) we throw a friendly error pointing
// at /cuenta/seguridad.
//
// The modal stays mounted while the user retries: an invalid code surfaces
// inside the modal so the user can try again without re-launching the
// destructive action.
//
// Usage:
//   const stepUp = useStepUp();
//   <StepUpModal runner={stepUp} />
//   ...
//   await stepUp.run(() => apiFetch(`/admin/profiles/${id}`, { method: "DELETE" }));
// ─────────────────────────────────────────────────────────────────────────

type Resolver<T = unknown> = {
  resolve: (v: T) => void;
  reject: (err: Error) => void;
};

export type StepUpRunner = ReturnType<typeof useStepUp>;

export function useStepUp() {
  const [pending, setPending] = useState<Resolver | null>(null);
  const [reason, setReason] = useState<"STEP_UP_REQUIRED" | "TOTP_REQUIRED" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const askForCode = useCallback(
    (newReason: "STEP_UP_REQUIRED" | "TOTP_REQUIRED") =>
      new Promise<void>((resolve, reject) => {
        setReason(newReason);
        setError(null);
        setPending({ resolve: resolve as Resolver["resolve"], reject });
      }),
    [],
  );

  const submitCode = useCallback(
    async (code: string) => {
      if (!pending) return;
      if (!/^\d{6}$/.test(code)) {
        setError("Ingresa un código de 6 dígitos.");
        return;
      }
      setSubmitting(true);
      setError(null);
      try {
        await apiFetch("/auth/2fa/verify", {
          method: "POST",
          body: JSON.stringify({ code }),
        });
        // Successful step-up — release the waiting `run()` call.
        pending.resolve(undefined);
        setPending(null);
        setReason(null);
      } catch (err: any) {
        if (err?.body?.error === "CODE_INVALID") {
          setError("Código incorrecto. Intenta de nuevo.");
        } else if (err?.body?.error === "TOTP_NOT_ENABLED") {
          setError("Activa 2FA en /cuenta/seguridad antes de continuar.");
        } else {
          setError(err?.body?.message || err?.message || "No pudimos verificar el código.");
        }
      } finally {
        setSubmitting(false);
      }
    },
    [pending],
  );

  const cancel = useCallback(() => {
    if (!pending) return;
    pending.reject(new Error("STEP_UP_CANCELLED"));
    setPending(null);
    setReason(null);
    setError(null);
  }, [pending]);

  const run = useCallback(
    async <T,>(action: () => Promise<T>): Promise<T> => {
      try {
        return await action();
      } catch (err) {
        if (!(err instanceof ApiHttpError)) throw err;
        const code = err?.body?.error;
        if (code !== "STEP_UP_REQUIRED" && code !== "TOTP_REQUIRED") throw err;
        if (code === "TOTP_REQUIRED") {
          throw new ApiHttpError(
            "Activa Google Authenticator en /cuenta/seguridad antes de continuar.",
            err.status,
            err.body,
          );
        }
        await askForCode(code);
        // Step-up succeeded — retry the original action once.
        return await action();
      }
    },
    [askForCode],
  );

  return {
    run,
    /** True when a code prompt is pending. */
    isPrompting: pending !== null,
    reason,
    submitCode,
    cancel,
    submitting,
    error,
  };
}
