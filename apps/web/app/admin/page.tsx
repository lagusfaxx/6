"use client";

import { useEffect } from "react";

export default function AdminIndex() {
  useEffect(() => {
    window.location.href = "/admin/pricing";
  }, []);
  return null;
}
