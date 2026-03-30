"use client";

import { useEffect, useState, useCallback } from "react";
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
  flowCardType?: string | null;
  flowCardLast4?: string | null;
};

export default function useSubscriptionStatus() {
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(() => {
    setLoading(true);
    apiFetch<SubscriptionStatus>("/billing/subscription/status")
      .then((data) => {
        setStatus(data);
        setError(null);
      })
      .catch((err) => {
        console.error("Failed to fetch subscription status:", err);
        setError(err.message || "Failed to load subscription status");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return { status, loading, error, refetch: fetchStatus };
}
