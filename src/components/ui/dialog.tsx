"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { useMovableDialog } from "@/hooks/useMovableDialog"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = ({
  ...props
}: DialogPrimitive.DialogPortalProps) => (
  <DialogPrimitive.Portal {...props} />
)
DialogPortal.displayName = DialogPrimitive.Portal.displayName

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay> & { lighter?: boolean }
>(({ className, lighter = false, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-[1200] bg-[var(--ui-scrim)] transition-colors data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      // En flyttad dialog har flyttats för att man vill se vad som ligger under.
      lighter && "bg-[var(--ui-scrim-light)]",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

type MovableHandlers = ReturnType<typeof useMovableDialog>["handlers"]

/** Kör anroparens händelse först och dialogens flytt sedan, på samma element. */
function composeHandlers(
  props: Record<string, unknown>,
  handlers: MovableHandlers
): MovableHandlers {
  const composed: Record<string, unknown> = {}
  for (const [name, own] of Object.entries(handlers)) {
    const theirs = props[name]
    composed[name] =
      typeof theirs === "function"
        ? (event: unknown) => {
            ;(theirs as (event: unknown) => void)(event)
            ;(own as (event: unknown) => void)(event)
          }
        : own
  }
  return composed as MovableHandlers
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    hideClose?: boolean
    /** Dialogen går att dra i titelraden och flytta med Ctrl+Cmd+pil. */
    movable?: boolean
    /** Namnet platsen minns under. Behövs när rubriken ändras, t.ex. "Dela "X"". */
    positionKey?: string
  }
>(({ className, children, hideClose = false, movable = true, positionKey, style, ...props }, ref) => {
  const move = useMovableDialog({ positionKey, enabled: movable })
  const moveRef = move.ref
  const setRefs = React.useCallback(
    (el: HTMLDivElement | null) => {
      moveRef(el)
      if (typeof ref === "function") ref(el)
      else if (ref) ref.current = el
    },
    [moveRef, ref]
  )
  return (
    <DialogPortal>
      <DialogOverlay lighter={move.moved} />
      <DialogPrimitive.Content
        ref={setRefs}
        {...props}
        {...composeHandlers(props, move.handlers)}
        data-dialog-movable={movable ? "" : undefined}
        style={
          move.moved
            ? {
                ...style,
                left: `calc(50% + ${move.offset.x}px)`,
                top: `calc(50% + ${move.offset.y}px)`,
                // duration-200 gäller alla egenskaper, även left och top.
                ...(move.dragging && { transition: "none" }),
              }
            : style
        }
        className={cn(
          "fixed left-[50%] top-[50%] z-[1300] grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border-frame border-ui-line bg-ui-surface text-ui-ink p-6 shadow-float duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-ui md:w-full",
          movable && "[&_[data-dialog-handle]]:cursor-move [&_[data-dialog-handle]]:touch-none",
          className
        )}
      >
        {children}
        {!hideClose && <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-white transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-[var(--ui-focus)] focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-black data-[state=open]:text-white">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
})
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    data-dialog-handle=""
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    data-dialog-handle=""
    className={cn(
      "text-lg ui-heading leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-ui-muted", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}