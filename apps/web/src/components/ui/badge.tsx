import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-all duration-200 overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow-sm [a&]:hover:bg-primary/90",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
        outline:
          "text-foreground border-border [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        // 新增变体
        success:
          "border-transparent bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 [a&]:hover:bg-emerald-500/25",
        warning:
          "border-transparent bg-amber-500/15 text-amber-600 dark:text-amber-400 [a&]:hover:bg-amber-500/25",
        info:
          "border-transparent bg-blue-500/15 text-blue-600 dark:text-blue-400 [a&]:hover:bg-blue-500/25",
        purple:
          "border-transparent bg-violet-500/15 text-violet-600 dark:text-violet-400 [a&]:hover:bg-violet-500/25",
        // 渐变变体
        gradient:
          "border-transparent bg-gradient-to-r from-primary to-blue-500 text-white",
        "gradient-success":
          "border-transparent bg-gradient-to-r from-emerald-500 to-teal-500 text-white",
        "gradient-warning":
          "border-transparent bg-gradient-to-r from-amber-500 to-yellow-500 text-white",
        "gradient-purple":
          "border-transparent bg-gradient-to-r from-violet-500 to-purple-500 text-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
