import { KeyboardEvent, useEffect, useLayoutEffect, useRef, useState } from "react";

export type SelectOption = { value: string; label: string; short?: string };

type Props = {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  columns?: number;
  ariaLabel?: string;
};

export function Select({ value, options, onChange, columns = 1, ariaLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [flip, setFlip] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value)
  );
  const current = options[selectedIndex];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  useLayoutEffect(() => {
    if (!open || !listRef.current) return;
    setFlip(listRef.current.getBoundingClientRect().right > window.innerWidth - 16);
  }, [open]);

  function show() {
    setActive(selectedIndex);
    setFlip(false);
    setOpen(true);
  }

  function pick(v: string) {
    onChange(v);
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent) {
    const step: Record<string, number> = {
      ArrowDown: columns,
      ArrowUp: -columns,
      ArrowRight: columns > 1 ? 1 : 0,
      ArrowLeft: columns > 1 ? -1 : 0,
    };
    if (e.key in step) {
      e.preventDefault();
      if (!open) return show();
      setActive((i) => Math.min(options.length - 1, Math.max(0, i + step[e.key])));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (open) pick(options[active].value);
      else show();
    } else if (e.key === "Escape" || e.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div className="select" ref={rootRef}>
      <button
        type="button"
        className={open ? "select-btn open" : "select-btn"}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
      >
        {current?.label ?? ""}
      </button>
      {open && (
        <ul
          ref={listRef}
          role="listbox"
          className={["select-list", columns > 1 && "grid", columns > 1 && columns < 4 && "words", flip && "flip"].filter(Boolean).join(" ")}
          style={
            columns > 1
              ? {
                  gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                  width: columns * (columns >= 4 ? 46 : 112) + 14,
                }
              : undefined
          }
        >
          {options.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              className={[o.value === value && "selected", i === active && "active"].filter(Boolean).join(" ")}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(o.value)}
            >
              {columns > 1 ? (o.short ?? o.label) : o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
