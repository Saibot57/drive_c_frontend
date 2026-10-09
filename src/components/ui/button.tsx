import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import * as React from "react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-ui-sm text-sm font-base ring-offset-white transition-all gap-2 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none",
  {
    variants: {
      variant: {
        default:
          "ui-press ui-press-accent text-ui-accent-fg bg-main border-frame border-border shadow-shadow hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none",
        noShadow: "text-ui-accent-fg bg-main border-frame border-border",
        neutral:
          "ui-press bg-bw text-text border-frame border-border shadow-shadow hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none",
        secondary:
          "bg-ui-paper text-text border border-border hover:bg-ui-surface-3",
        reverse:
          "ui-press ui-press-accent text-ui-accent-fg bg-main border-frame border-border hover:translate-x-reverseBoxShadowX hover:translate-y-reverseBoxShadowY hover:shadow-shadow",
      },
      size: {
        default: "h-[var(--ui-btn-h)] px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
        icon: "h-[var(--ui-btn-h)] w-[var(--ui-btn-h)]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

/**
 * Sätter anroparen en egen botten (`bg-emerald-100`, `bg-transparent`) är
 * knappen inte längre en primärknapp. Då ska texten följa sidans bläck och
 * inte primärknappens textfärg, som i Kronberg är vit. I Neo är båda svarta.
 */
const hasOwnBackground = (className?: string) => /(^|\s)bg-/.test(className ?? "")

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    const isAccent = variant === undefined || variant === null || variant === "default"
      || variant === "noShadow" || variant === "reverse"
    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size }),
          isAccent && hasOwnBackground(className) && "text-mtext ui-press-plain",
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }
