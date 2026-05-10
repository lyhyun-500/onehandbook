import { type InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

const baseClasses =
  "flex h-10 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm " +
  "placeholder:text-muted-foreground " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background " +
  "disabled:opacity-50 disabled:cursor-not-allowed " +
  "aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive";

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type = "text", ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(baseClasses, className)}
      {...props}
    />
  );
});
Input.displayName = "Input";
