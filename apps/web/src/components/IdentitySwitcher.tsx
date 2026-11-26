import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import {
  Check,
  ChevronDown,
  ShieldCheck,
  UserRound,
  ArrowLeftRight,
} from "lucide-react";
export type DemoIdentity = { id: string; name: string; role: string };
// Derive a compact avatar label from the selected person's display name.
function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
}
// Switch demo personas through a keyboard-accessible profile menu with explicit role labels.
export function IdentitySwitcher({
  identities,
  value,
  onChange,
}: {
  identities: DemoIdentity[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    items = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();
  const groups = [
    {
      title: "BANK TEAM",
      people: identities.filter((person) => person.role === "reviewer"),
    },
    {
      title: "CUSTOMER VIEWS",
      people: identities.filter((person) => person.role !== "reviewer"),
    },
  ];
  const options = groups.flatMap((group) => group.people);
  const selected = identities.find((person) => person.id === value);
  const selectedIndex = Math.max(
    0,
    options.findIndex((person) => person.id === value),
  );
  const initialFocus = useRef<number | null>(null);
  useEffect(() => {
    if (open) {
      items.current[initialFocus.current ?? selectedIndex]?.focus();
      initialFocus.current = null;
    }
  }, [open, selectedIndex]);
  useEffect(() => {
    if (!open) return;
    // Dismiss the menu on an outside pointer action without stealing destination focus.
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  // Apply one persona selection and restore keyboard focus to the trigger.
  function choose(id: string) {
    setOpen(false);
    if (id !== value) onChange(id);
    trigger.current?.focus();
  }
  // Traverse available identities using the standard menu keyboard interactions.
  function navigate(event: KeyboardEvent<HTMLDivElement>) {
    const index = items.current.findIndex(
      (item) => item === document.activeElement,
    );
    let next: number | undefined;
    if (event.key === "ArrowDown") next = (index + 1) % options.length;
    else if (event.key === "ArrowUp")
      next = (index - 1 + options.length) % options.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = options.length - 1;
    else if (event.key === "Tab") {
      event.preventDefault();
      const controls = Array.from(
        document.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input, textarea, select, [tabindex="0"]',
        ),
      ).filter(
        (element) =>
          element.tabIndex >= 0 && element.getClientRects().length > 0,
      );
      const triggerIndex = controls.findIndex(
        (element) => element === trigger.current,
      );
      const destination = event.shiftKey
        ? trigger.current
        : controls[triggerIndex + 1];
      setOpen(false);
      (destination || trigger.current)?.focus();
      return;
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
      return;
    } else if (
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      event.key !== " "
    ) {
      const match = options.findIndex(
        (person, i) =>
          i > index &&
          person.name.toLowerCase().startsWith(event.key.toLowerCase()),
      );
      next =
        match >= 0
          ? match
          : options.findIndex((person) =>
              person.name.toLowerCase().startsWith(event.key.toLowerCase()),
            );
    }
    if (next !== undefined && next >= 0) {
      event.preventDefault();
      items.current[next]?.focus();
    }
  }
  // Open at the first or last identity when using arrow keys on the trigger.
  function openWithKeyboard(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      initialFocus.current = event.key === "ArrowDown" ? 0 : options.length - 1;
      setOpen(true);
    }
  }
  return (
    <div
      className="identity-switcher"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        className={"profile-trigger" + (open ? " is-open" : "")}
        aria-label={
          selected
            ? `Switch profile, ${selected.name}, ${selected.role === "reviewer" ? "bank reviewer" : "customer"}`
            : "Loading profiles"
        }
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={!selected}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={openWithKeyboard}
      >
        <span
          className={
            "profile-avatar " +
            (selected?.role === "reviewer" ? "is-reviewer" : "")
          }
        >
          {selected ? initials(selected.name) : "…"}
        </span>
        <span className="profile-copy">
          <strong>{selected?.name || "Loading profiles…"}</strong>
          <span>
            {selected?.role === "reviewer" ? (
              <ShieldCheck size={11} />
            ) : (
              <UserRound size={11} />
            )}
            {selected?.role === "reviewer"
              ? "Bank reviewer"
              : "Customer account"}
          </span>
        </span>
        <ChevronDown size={17} className="profile-chevron" />
      </button>
      {open && (
        <div
          id={menuId}
          className="profile-menu"
          role="menu"
          aria-label="Switch demonstration profile"
          onKeyDown={navigate}
        >
          <div className="profile-menu-heading">
            <span className="profile-menu-icon">
              <ArrowLeftRight size={16} />
            </span>
            <div>
              <strong>Switch profile</strong>
              <p>Choose the view you want to explore.</p>
            </div>
            <span className="profile-demo">DEMO</span>
          </div>
          {groups
            .filter((group) => group.people.length)
            .map((group) => (
              <div
                role="group"
                aria-label={group.title}
                key={group.title}
                className="profile-group"
              >
                <span className="profile-group-label">{group.title}</span>
                {group.people.map((person) => {
                  const index = options.findIndex(
                    (option) => option.id === person.id,
                  );
                  const active = person.id === value;
                  return (
                    <button
                      type="button"
                      key={person.id}
                      ref={(element) => {
                        items.current[index] = element;
                      }}
                      role="menuitemradio"
                      aria-checked={active}
                      tabIndex={-1}
                      className={
                        "profile-option" + (active ? " is-selected" : "")
                      }
                      onClick={() => choose(person.id)}
                    >
                      <span
                        className={
                          "profile-avatar " +
                          (person.role === "reviewer" ? "is-reviewer" : "")
                        }
                      >
                        {initials(person.name)}
                      </span>
                      <span className="profile-option-copy">
                        <strong>{person.name}</strong>
                        <span>
                          {person.role === "reviewer"
                            ? "Review evidence and approve proposals"
                            : "Raise disputes and review resolutions"}
                        </span>
                      </span>
                      <span className="profile-option-check">
                        {active && <Check size={14} />}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          <div className="profile-menu-footer">
            <span />
            Local demo identities · no sign-in required
          </div>
        </div>
      )}
    </div>
  );
}
