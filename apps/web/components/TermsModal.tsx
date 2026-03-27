"use client";

import { useState, useEffect } from "react";
import { X, FileText, ChevronDown, ExternalLink } from "lucide-react";

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
  type: "client" | "business";
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

export default function TermsModal({ isOpen, onClose, onAccept, type }: TermsModalProps) {
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const isMobile = useIsMobile();

  if (!isOpen) return null;

  const pdfUrl =
    type === "client" ? "/terms/terminos-cliente.pdf" : "/terms/terminos-oferente.pdf";
  const title =
    type === "client"
      ? "Términos y Condiciones — Usuario Final"
      : "Términos y Condiciones — Usuario Oferente";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal — full-screen on mobile, constrained on desktop */}
      <div className="relative w-full h-full sm:h-auto sm:max-w-2xl sm:max-h-[90vh] flex flex-col sm:rounded-3xl border border-white/10 bg-[#0d0e1a]/95 backdrop-blur-2xl shadow-[0_30px_80px_rgba(0,0,0,0.6)] overflow-hidden">
        {/* Top glow */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400/50 to-transparent" />

        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-gradient-to-br from-fuchsia-500/20 to-violet-500/20 border border-white/10 flex items-center justify-center shrink-0">
              <FileText className="h-4 w-4 text-fuchsia-300" />
            </div>
            <h2 className="text-sm sm:text-lg font-semibold text-white truncate">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* PDF Viewer */}
        <div
          className="flex-1 overflow-auto min-h-0"
          style={{ WebkitOverflowScrolling: "touch" }}
          onScroll={(e) => {
            const el = e.currentTarget;
            const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
            if (nearBottom) setScrolledToBottom(true);
          }}
        >
          {isMobile ? (
            /* On mobile, use Google Docs viewer which renders PDFs properly with scrolling */
            <iframe
              src={`https://docs.google.com/gview?embedded=true&url=${typeof window !== "undefined" ? window.location.origin : ""}${pdfUrl}`}
              className="w-full border-0"
              style={{ height: "100%", minHeight: "calc(100vh - 160px)" }}
              title={title}
              onLoad={() => {
                setTimeout(() => setScrolledToBottom(true), 2000);
              }}
            />
          ) : (
            <iframe
              src={`${pdfUrl}#toolbar=0`}
              className="w-full border-0"
              style={{ height: "60vh", minHeight: "400px" }}
              title={title}
              onLoad={() => {
                setTimeout(() => setScrolledToBottom(true), 2000);
              }}
            />
          )}
        </div>

        {/* Scroll hint */}
        {!scrolledToBottom && (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1.5 rounded-full bg-black/60 border border-white/10 text-xs text-white/50 animate-bounce">
            <ChevronDown className="h-3 w-3" />
            Revisa el documento
          </div>
        )}

        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-white/10 bg-white/[0.02] shrink-0">
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 text-xs text-fuchsia-300/70 hover:text-fuchsia-300 underline transition sm:justify-start"
          >
            <ExternalLink className="h-3 w-3" />
            Abrir PDF en nueva pestaña
          </a>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl border border-white/15 bg-white/5 text-sm font-medium text-white/70 hover:bg-white/10 transition"
            >
              Cancelar
            </button>
            <button
              onClick={onAccept}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 text-sm font-semibold text-white shadow-lg hover:brightness-110 transition"
            >
              Acepto los términos
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
