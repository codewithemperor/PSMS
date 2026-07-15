"use client"

import Link from "next/link"
import { GraduationCap, Home, ArrowLeft } from "lucide-react"

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-white to-emerald-50/40 px-4 py-8">
      {/* Background blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 top-0 h-96 w-96 rounded-full bg-emerald-100/30 blur-3xl" />
        <div className="absolute -right-40 bottom-0 h-96 w-96 rounded-full bg-teal-100/20 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md text-center">
        {/* Brand */}
        <div className="mb-6 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-600/20">
            <GraduationCap className="h-8 w-8" />
          </div>
        </div>

        {/* 404 */}
        <p className="bg-gradient-to-br from-emerald-500 to-teal-600 bg-clip-text text-7xl font-extrabold text-transparent">
          404
        </p>
        <h1 className="mt-3 text-2xl font-bold text-slate-800">
          Page not found
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          The page you&apos;re looking for doesn&apos;t exist or may have been
          moved. If you reached this page from a link inside PSMS, please let
          your administrator know.
        </p>

        {/* Actions */}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
          >
            <Home className="h-4 w-4" />
            Back to Login
          </Link>
          <button
            onClick={() => history.back()}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </button>
        </div>

        <p className="mt-8 text-[11px] text-slate-300">
          © 2025 PSMS · Department of Computer Science
        </p>
      </div>
    </div>
  )
}
