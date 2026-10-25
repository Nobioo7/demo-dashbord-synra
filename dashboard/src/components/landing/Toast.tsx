"use client";

import { useEffect } from "react";

type ToastProps = {
  message: string;
  visible: boolean;
  onDismiss: () => void;
};

export default function Toast({ message, visible, onDismiss }: ToastProps) {
  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(onDismiss, 3600);
    return () => window.clearTimeout(timer);
  }, [message, onDismiss, visible]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-8 left-1/2 z-[80] flex -translate-x-1/2 items-center gap-2 rounded-md border border-neutral-800 bg-white px-6 py-3.5 text-[13px] font-medium text-black transition-all duration-500 ${
        visible ? "translate-y-0 opacity-100" : "translate-y-32 opacity-0 pointer-events-none"
      }`}
      style={{ transitionTimingFunction: "cubic-bezier(.16,1,.3,1)" }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
        <path d="M20 6L9 17l-5-5" />
      </svg>
      <span>{message}</span>
    </div>
  );
}
