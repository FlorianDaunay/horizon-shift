import type { ButtonHTMLAttributes, ReactNode } from "react";

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(" ");

type ButtonVariant = "primary" | "secondary" | "ghost";

const buttonStyles: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-foreground hover:bg-accent-hover border-transparent",
  secondary: "bg-surface text-text-primary hover:bg-surface-hover border-border",
  ghost: "bg-transparent text-text-secondary hover:bg-surface-hover hover:text-text-primary border-transparent",
};

export function Button({
  variant = "secondary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      {...props}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-control border px-4 py-2 text-sm font-medium",
        "shadow-control transition-colors active:shadow-inset disabled:pointer-events-none disabled:opacity-50",
        buttonStyles[variant],
        className
      )}
    />
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[1.6rem] items-center justify-center rounded-control border bg-surface-hover px-1.5 py-0.5 font-mono text-xs text-text-primary shadow-control">
      {children}
    </kbd>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">{title}</h3>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-text-primary">{label}</span>
        {hint && <span className="font-mono text-xs text-text-muted">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" className="flex flex-wrap gap-1 rounded-control border bg-canvas p-1">
      {options.map((option) => (
        <button
          key={option.value}
          role="radio"
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
          className={cx(
            "flex-1 rounded-control px-3 py-1.5 text-sm transition-colors",
            option.value === value
              ? "bg-accent text-accent-foreground"
              : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  label,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  label: string;
}) {
  return (
    <input
      type="range"
      aria-label={label}
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(event) => onChange(Number(event.target.value))}
      className="w-full accent-accent"
    />
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 text-left"
    >
      <span className="text-sm text-text-primary">{label}</span>
      <span className={cx("relative h-6 w-11 shrink-0 rounded-pill border transition-colors", checked ? "bg-accent" : "bg-canvas")}>
        <span
          className={cx(
            "absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-pill bg-text-primary transition-all",
            checked ? "left-[1.4rem] bg-accent-foreground" : "left-1"
          )}
        />
      </span>
    </button>
  );
}

export { cx };
