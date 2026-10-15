import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

const variants = {
  primary:
    "border-transparent bg-primary text-primary-foreground shadow-sm " +
    "transition-[colors,transform,box-shadow] " +
    "hover:bg-primary-dark hover:-translate-y-px hover:shadow-md " +
    "active:translate-y-0 active:scale-[0.98] active:shadow-sm",
  outline:
    "border-border bg-surface text-foreground hover:bg-muted",
  ghost:
    "border-transparent bg-transparent text-foreground hover:bg-muted",
  link:
    "border-transparent bg-transparent text-link underline-offset-4 hover:underline px-0 shadow-none",
} as const;

const sizes = {
  sm: "h-8 px-2.5 text-[0.8rem]",
  md: "h-9 px-3 text-sm",
  lg: "h-10 px-4 text-sm",
} as const;

type Variant = keyof typeof variants;
type Size = keyof typeof sizes;

type Common = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
};

type ButtonAsButton = Common &
  Omit<ComponentProps<"button">, "className" | "children"> & {
    href?: undefined;
  };

type ButtonAsLink = Common &
  Omit<ComponentProps<typeof Link>, "className" | "children"> & {
    href: string;
  };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

function buttonClassName(
  variant: Variant,
  size: Size,
  className?: string,
): string {
  return cn(
    "inline-flex items-center justify-center gap-1.5 rounded-lg border font-semibold outline-none select-none",
    "transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
    className,
  );
}

export function Button(props: ButtonProps) {
  const variant = props.variant ?? "primary";
  const size = props.size ?? "md";

  if (props.href !== undefined) {
    const { href, variant: _v, size: _s, className, children, ...rest } = props;
    return (
      <Link
        href={href}
        className={buttonClassName(variant, size, className)}
        {...rest}
      >
        {children}
      </Link>
    );
  }

  const { variant: _v, size: _s, className, children, type, ...rest } = props;
  return (
    <button
      type={type ?? "button"}
      className={buttonClassName(variant, size, className)}
      {...rest}
    >
      {children}
    </button>
  );
}
