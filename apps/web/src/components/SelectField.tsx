import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown } from "lucide-react";
export type SelectOption = {
  value: string;
  label: string;
  description?: string;
};
// Provide a styled, keyboard-accessible select while retaining standard form submission values.
export function SelectField({
  name,
  label,
  options,
  onChange,
  value: controlledValue,
}: {
  name: string;
  label: string;
  options: SelectOption[];
  onChange?: (value: string) => void;
  value?: string;
}) {
  const [value, setValue] = useState<string>(),
    [open, setOpen] = useState(false),
    [active, setActive] = useState(0),
    [above, setAbove] = useState(false),
    [height, setHeight] = useState(280);
  const root = useRef<HTMLDivElement>(null),
    button = useRef<HTMLButtonElement>(null),
    list = useRef<HTMLDivElement>(null);
  const id = useId();
  const selected =
    options.find((option) => option.value === (controlledValue ?? value)) ||
    options[0];
  useEffect(() => {
    if (!open) return;
    // Close the options when pointer interaction moves outside this field.
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  useEffect(() => {
    const menu = list.current;
    const option = menu?.children[active] as HTMLElement | undefined;
    if (!open || !menu || !option) return;
    if (option.offsetTop < menu.scrollTop) menu.scrollTop = option.offsetTop;
    else if (
      option.offsetTop + option.offsetHeight >
      menu.scrollTop + menu.clientHeight
    )
      menu.scrollTop =
        option.offsetTop + option.offsetHeight - menu.clientHeight;
  }, [active, open]);
  // Place the menu into the larger available space within its scrollable dialog.
  function expand(index?: number) {
    const rect = button.current?.getBoundingClientRect();
    const dialog = root.current
      ?.closest('[role="dialog"]')
      ?.getBoundingClientRect();
    if (rect) {
      const below =
        Math.min(window.innerHeight, dialog?.bottom ?? window.innerHeight) -
        rect.bottom -
        18;
      const top = rect.top - Math.max(0, dialog?.top ?? 0) - 18;
      const up = below < 240 && top > below;
      setAbove(up);
      setHeight(Math.max(100, Math.min(300, up ? top : below)));
    }
    setActive(
      index ??
        Math.max(
          0,
          options.findIndex((option) => option.value === selected?.value),
        ),
    );
    setOpen(true);
  }
  // Commit the chosen value without submitting or closing the enclosing dispute form.
  function choose(index: number) {
    const option = options[index];
    if (option) {
      setValue(option.value);
      onChange?.(option.value);
      setOpen(false);
      button.current?.focus();
    }
  }
  // Match native select navigation including arrows, boundaries, typing, Escape and Tab.
  function keyboard(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      return;
    }
    if (event.key === "Tab") {
      setOpen(false);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open) choose(active);
      else expand();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) expand();
      else
        setActive(
          (current) =>
            (current + (event.key === "ArrowDown" ? 1 : -1) + options.length) %
            options.length,
        );
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const index = event.key === "Home" ? 0 : options.length - 1;
      if (open) setActive(index);
      else expand(index);
      return;
    }
    if (
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      const after = options.findIndex(
        (option, index) =>
          index > active &&
          option.label.toLowerCase().startsWith(event.key.toLowerCase()),
      );
      const index =
        after >= 0
          ? after
          : options.findIndex((option) =>
              option.label.toLowerCase().startsWith(event.key.toLowerCase()),
            );
      if (index >= 0) {
        event.preventDefault();
        if (open) setActive(index);
        else expand(index);
      }
    }
  }
  return (
    <div className="custom-select" ref={root}>
      <input type="hidden" name={name} value={selected?.value || ""} />
      <button
        ref={button}
        type="button"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-haspopup="listbox"
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        disabled={!options.length}
        className={"select-trigger" + (open ? " is-open" : "")}
        onClick={() => (open ? setOpen(false) : expand())}
        onKeyDown={keyboard}
        onBlur={() => setOpen(false)}
      >
        <span className="select-value">
          <strong>{selected?.label || "No options available"}</strong>
          {selected?.description && <small>{selected.description}</small>}
        </span>
        <ChevronDown size={19} />
      </button>
      {open && (
        <div className={"select-popover" + (above ? " opens-above" : "")}>
          <div
            ref={list}
            id={id}
            role="listbox"
            aria-label={label}
            className="select-options"
            style={{ maxHeight: height }}
          >
            {options.map((option, index) => (
              <div
                key={option.value}
                id={`${id}-${index}`}
                role="option"
                aria-selected={option.value === selected?.value}
                className={
                  "select-option" +
                  (index === active ? " is-active" : "") +
                  (option.value === selected?.value ? " is-selected" : "")
                }
                onMouseDown={(event) => event.preventDefault()}
                onPointerMove={() => setActive(index)}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  choose(index);
                }}
              >
                <span>
                  <strong>{option.label}</strong>
                  {option.description && <small>{option.description}</small>}
                </span>
                <span className="select-check">
                  {option.value === selected?.value && <Check size={15} />}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
