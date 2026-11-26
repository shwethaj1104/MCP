import { useEffect, useRef, type ReactNode } from "react";
// Keep keyboard focus inside an open modal and restore focus when it closes.
export function Dialog({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = ref.current;
    const selector =
      'button:not([disabled]), input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), summary, [tabindex="0"]';
    (element?.querySelector(selector) as HTMLElement | null)?.focus();
    // Close on Escape and cycle focus across the modal's interactive controls.
    function keyboard(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !element) return;
      const controls = Array.from(
        element.querySelectorAll<HTMLElement>(selector),
      ).filter((control) => control.getClientRects().length > 0);
      const first = controls[0],
        last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", keyboard);
    return () => {
      document.removeEventListener("keydown", keyboard);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" ref={ref}>
      {children}
    </div>
  );
}
