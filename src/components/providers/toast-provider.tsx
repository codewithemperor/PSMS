"use client"

import { Toaster as SonnerToaster } from "sonner"

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        style: {
          borderRadius: "0.75rem",
          border: "1px solid rgb(226 232 240 / 0.6)",
        },
      }}
    />
  )
}
