"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

type SubscriptionStatus = {
  requiresPayment: boolean;
  isActive: boolean;
  membershipActive?: boolean;
  trialActive?: boolean;
  daysRemaining?: number;
  membershipExpiresAt?: string | null;
  shopTrialEndsAt?: string | null;
  profileType: string;
  subscriptionPrice?: number;
  recentPayments?: Array<{
    id: string;
    status: string;
    amount: number;
    paidAt: string | null;
    createdAt: string;
  }>;
  flowSubscriptionId?: string | null;
  flowSubscriptionStatus?: string | null;
};

export default function useSubscriptionStatus() {
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    
    apiFetch<SubscriptionStatus>("/billing/subscription/status")
      .then((data) => {
        if (!alive) return;
        setStatus(data);
        setError(null);
      })
      .catch((err) => {
        if (!alive) return;
        console.error("Failed to fetch subscription status:", err);
        setError(err.message || "Failed to load subscription status");
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    
    return () => {
      alive = false;
    };
  }, []);

  return { status, loading, error };
}
