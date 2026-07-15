import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { AuthProvider } from "@/components/providers/auth-provider"
import { QueryProvider } from "@/components/providers/query-provider"
import { Toaster } from "@/components/providers/toast-provider"
import { DynamicTitle } from "@/components/shared/dynamic-title"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })

// Static fallback metadata. The dynamic document title is updated client-side
// by <DynamicTitle /> based on the configured app name (see SystemConfig).
export const metadata: Metadata = {
  title: "PSMS — Project Supervision Management System",
  description:
    "A computer-based platform for managing final-year project supervision: students, supervisors, topics, documents, milestones and feedback.",
  keywords: [
    "PSMS",
    "project supervision",
    "student projects",
    "supervisor management",
    "Next.js",
  ],
  authors: [{ name: "PSMS Team" }],
  icons: {
    icon: "/logo.svg",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} min-h-screen bg-slate-50 antialiased`}
      >
        <AuthProvider>
          <QueryProvider>
            <DynamicTitle />
            {children}
            <Toaster />
          </QueryProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
