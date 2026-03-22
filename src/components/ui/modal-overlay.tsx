"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type ModalOverlayProps = {
  children: ReactNode;
  onClose?: () => void;
};

export function ModalOverlay({ children, onClose }: ModalOverlayProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    return () => {
      setIsMounted(false);
    };
  }, []);

  useEffect(() => {
    if (!onClose) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose?.();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!isMounted) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-background/80 px-4 py-4 backdrop-blur-sm sm:py-8"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.();
        }
      }}
    >
      <div className="flex max-h-full w-full items-start justify-center" onMouseDown={(event) => event.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body
  );
}
