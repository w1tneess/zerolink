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

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
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
      className={`zl-dialog animate-modal m-auto w-[calc(100%-2rem)] ${maxWidthClass} rounded-3xl bg-[var(--bezel-outer)] p-2 text-[var(--text)] ring-1 ring-[var(--bezel-ring)]`}
    >
      <div className="rounded-2xl bg-[var(--surface)] p-6 shadow-[var(--shadow-float),inset_0_1px_0_var(--inner-highlight)]">
        {children}
      </div>
    </dialog>
  );
}
