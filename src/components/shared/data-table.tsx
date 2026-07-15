"use client"

import { useState, type ReactNode } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Search, ChevronLeft, ChevronRight } from "lucide-react"
import { EmptyState } from "./empty-state"
import { Inbox } from "lucide-react"

export interface Column<T> {
  key: keyof T | string
  header: string
  render?: (row: T) => ReactNode
  className?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  pageSize?: number
  searchable?: boolean
  searchKeys?: (keyof T)[]
  emptyTitle?: string
  emptyDescription?: string
}

export function DataTable<T extends { id: string }>({
  columns,
  data,
  pageSize = 10,
  searchable = true,
  searchKeys,
  emptyTitle = "No records found",
  emptyDescription = "Records will appear here once they are added.",
}: DataTableProps<T>) {
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)

  // --- Filter ---
  const filtered = searchable && query
    ? data.filter((row) => {
        const keys = searchKeys ?? (columns.map((c) => c.key) as (keyof T)[])
        return keys.some((k) =>
          String(row[k] ?? "")
            .toLowerCase()
            .includes(query.toLowerCase()),
        )
      })
    : data

  // --- Paginate ---
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const start = (currentPage - 1) * pageSize
  const rows = filtered.slice(start, start + pageSize)

  return (
    <div className="space-y-3">
      {searchable && (
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(1)
            }}
            className="rounded-lg pl-9"
          />
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
              {columns.map((col) => (
                <TableHead
                  key={String(col.key)}
                  className={`text-xs font-semibold uppercase tracking-wide text-slate-500 ${col.className ?? ""}`}
                >
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-0">
                  <EmptyState
                    icon={Inbox}
                    title={emptyTitle}
                    description={emptyDescription}
                  />
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="border-slate-100 transition-colors hover:bg-slate-50/50"
                >
                  {columns.map((col) => (
                    <TableCell
                      key={String(col.key)}
                      className={`text-sm text-slate-600 ${col.className ?? ""}`}
                    >
                      {col.render
                        ? col.render(row)
                        : String(row[col.key as keyof T] ?? "")}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {filtered.length > pageSize && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-slate-400">
            Showing {start + 1}–{Math.min(start + pageSize, filtered.length)}{" "}
            of {filtered.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 text-xs font-medium text-slate-600">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
