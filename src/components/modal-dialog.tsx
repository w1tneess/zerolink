"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface ModalDialogProps {
  open: boolean;
  onClose: () => void;
  ariaLabelledBy: string;
  maxWidthClass?: string;
  children: ReactNode;
}

export function ModalDialog({
  open,
  onClose,
  ariaLabelledBy,
  maxWidthClass = "max-w-md",
  children,
}: ModalDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      previousFocusRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      if (!dialog.open) {
        dialog.showModal();
      }
      const initialTarget =
        dialog.querySelector<HTMLElement>("[data-initial-focus]") ??
        dialog.querySelector<HTMLElement>("[autofocus]") ??
        dialog.querySelector<HTMLElement>(
          "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])"
        );
      initialTarget?.focus();
    }

    return () => {
      if (dialog.open) {
        dialog.close();
      }
      const prev = previousFocusRef.current;
      if (prev && prev.isConnected) {
        requestAnimationFrame(() => prev.focus());
      }
      previousFocusRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if ("closedBy" in HTMLDialogElement.prototype) return;

    const handleBackdropClick = (event: MouseEvent) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const insideContent =
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width;
      if (!insideContent) {
        dialog.close();
      }
    };

    dialog.addEventListener("click", handleBackdropClick);
    return () => dialog.removeEventListener("click", handleBackdropClick);
  }, []);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={ariaLabelledBy}
      onClose={onClose}
      {...({ closedby: "any" } as Record<string, string>)}
      className={`zl-dialog animate-modal m-auto w-[calc(100%-2rem)] ${maxWidthClass} rounded-xl border border-[var(--line-strong)] bg-[var(--surface)] p-6 text-[var(--text)] shadow-[var(--shadow-float)]`}
    >
      {children}
    </dialog>
  );
}
