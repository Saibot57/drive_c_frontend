"use client"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import * as React from "react"
import { cn } from "@/lib/utils"

function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
  value?: number
}) {
  const [progress, setProgress] = React.useState(0)
  
  React.useEffect(() => {
    if (value !== undefined) {
      setProgress(value)
    } else {
      // Create an indeterminate animation that continuously moves from 0 to 100
      const interval = setInterval(() => {
        setProgress((prev) => (prev >= 100 ? 0 : prev + 2))
      }, 100)
      
      return () => clearInterval(interval)
    }
  }, [value])

  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "relative h-4 w-full overflow-hidden rounded-base border-2 border-border bg-white",
        className,
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="h-full bg-[#ff6b6b] transition-transform duration-300 ease-in-out"
        style={{ 
          width: '100%',
          transform: `translateX(-${100 - progress}%)`
        }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }