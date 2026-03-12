"use client";

import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      position="top-right"
      toastOptions={{
        className: "bg-background border text-foreground",
        duration: 4000
      }}
    />
  );
}
