import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-emerald-50/40 px-4">
      <div className="w-full max-w-md space-y-4">
        <div className="flex flex-col items-center">
          <Skeleton className="h-14 w-14 rounded-xl" />
          <Skeleton className="mt-4 h-7 w-24" />
          <Skeleton className="mt-2 h-4 w-56" />
          <Skeleton className="mt-4 h-0.5 w-16" />
        </div>
        <div className="space-y-4 rounded-2xl border border-slate-200/60 bg-white p-8 shadow-sm">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-11 w-full rounded-lg" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-11 w-full rounded-lg" />
          </div>
          <Skeleton className="h-11 w-full rounded-lg" />
        </div>
      </div>
    </div>
  )
}
