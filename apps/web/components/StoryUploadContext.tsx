"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

type StoryUploadContextValue = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
};

const StoryUploadContext = createContext<StoryUploadContextValue>({
  isOpen: false,
  open: () => {},
  close: () => {},
});

export function StoryUploadProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <StoryUploadContext.Provider value={{ isOpen, open, close }}>
      {children}
    </StoryUploadContext.Provider>
  );
}

export function useStoryUpload() {
  return useContext(StoryUploadContext);
}
