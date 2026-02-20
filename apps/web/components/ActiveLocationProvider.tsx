"use client";

import React from "react";
import {
  ActiveLocationContext,
  useActiveLocationState,
} from "../hooks/useActiveLocation";

export default function ActiveLocationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const value = useActiveLocationState();
  return (
    <ActiveLocationContext.Provider value={value}>
      {children}
    </ActiveLocationContext.Provider>
  );
}
