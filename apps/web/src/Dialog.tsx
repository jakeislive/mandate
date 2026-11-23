// A centred modal. Closes on Escape and on a click outside the panel.
import { useEffect, useRef, type ReactNode } from "react";
import { CloseIcon } from "./icons.tsx";
import { TestNetworkWarning } from "./TestNetworkWarning.tsx";

interface DialogProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Extra class on the dialog panel. */
  className?: string;
  variant?: "sheet" | "bare";
}

export function Dialog({ title, onClose, children, className, variant = "sheet" }: DialogProps) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close.current();
      if (event.key === "Tab") {
        const elements = panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea, a[href], [tabindex="0"]');
        if (!elements?.length) { event.preventDefault(); return; }
        const first = elements[0]!;
        const last = elements[elements.length - 1]!;
        if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    // Keep keyboard focus inside the dialog from the start.
    panel.current?.focus();
    return () => { document.removeEventListener("keydown", onKey); previousFocus?.focus(); };
  }, []);

  return (
    <div
      className="backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        className={`dialog is-${variant} ${className ?? ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <header className="dialog-header">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <CloseIcon size={18} />
          </button>
        </header>
        <TestNetworkWarning />
        {children}
      </div>
    </div>
  );
}
