"use client";

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MobileButton({ className, size, ...props }: ButtonProps) {
  return (
    <Button
      size={size ?? "lg"}
      className={cn("min-h-14 w-full rounded-2xl text-base font-bold shadow-lg", className)}
      {...props}
    />
  );
}
