import { useEffect, useRef } from "react";
import { Search, X } from "lucide-react";

// Offer compact case search with a clear action and a slash shortcut outside editable fields.
export function CaseSearch({
  value,
  onChange,
  label = "Search disputes",
  placeholder = "Find a case…",
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // Focus search without intercepting typing, modified shortcuts or other open dialogs.
    function shortcut(event: KeyboardEvent) {
      const target = event.target;
      if (
        event.key !== "/" ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.defaultPrevented ||
        document.querySelector('[role="dialog"]')
      )
        return;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.closest('input, textarea, select, [role="combobox"]'))
      )
        return;
      event.preventDefault();
      input.current?.focus();
    }
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, []);
  return (
    <div
      className={`case-search${value ? " has-query" : ""}`}
      role="search"
      aria-label={label}
    >
      <span className="case-search-icon">
        <Search size={17} aria-hidden="true" />
      </span>
      <input
        ref={input}
        aria-label={label}
        aria-keyshortcuts="/"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && value) {
            event.preventDefault();
            event.stopPropagation();
            onChange("");
          }
        }}
      />
      {value ? (
        <button
          type="button"
          className="case-search-clear"
          aria-label={`Clear ${label.toLowerCase()}`}
          onClick={() => {
            onChange("");
            input.current?.focus();
          }}
        >
          <X size={15} />
        </button>
      ) : (
        <kbd aria-hidden="true">/</kbd>
      )}
    </div>
  );
}
