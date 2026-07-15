"use client"

import { useState, useRef, type DragEvent } from "react"
import { Upload, FileText, X, CheckCircle2 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface FileUploaderProps {
  onFileSelect: (file: File) => void
  accept?: string
  maxSizeMB?: number
}

export function FileUploader({
  onFileSelect,
  accept = ".pdf,.docx,.doc",
  maxSizeMB = 10,
}: FileUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (file: File) => {
    setError("")
    const sizeMB = file.size / (1024 * 1024)
    if (sizeMB > maxSizeMB) {
      setError(`File exceeds ${maxSizeMB}MB limit`)
      return
    }
    const ext = file.name.split(".").pop()?.toLowerCase()
    const allowed = accept.split(",").map((a) => a.trim().replace(".", ""))
    if (ext && !allowed.includes(ext)) {
      setError(`Only ${accept} files are allowed`)
      return
    }
    setSelectedFile(file)
    onFileSelect(file)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const removeFile = () => {
    setSelectedFile(null)
    setError("")
    if (inputRef.current) inputRef.current.value = ""
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
        }}
      />

      <AnimatePresence mode="wait">
        {selectedFile ? (
          <motion.div
            key="file"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3 rounded-xl border border-slate-200/60 bg-white p-4"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-50">
              <FileText className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-700">
                {selectedFile.name}
              </p>
              <p className="text-xs text-slate-400">
                {(selectedFile.size / 1024).toFixed(0)} KB
              </p>
            </div>
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
            <button
              onClick={removeFile}
              className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => inputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
              isDragging
                ? "border-emerald-400 bg-emerald-50/50"
                : "border-slate-300 bg-white hover:border-emerald-300 hover:bg-emerald-50/30"
            }`}
          >
            <Upload className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-600">
              Drag and drop your file here, or{" "}
              <span className="text-emerald-600">click to browse</span>
            </p>
            <p className="mt-1 text-xs text-slate-400">
              PDF, DOCX, or DOC up to {maxSizeMB}MB
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <p className="mt-2 text-sm text-rose-500">{error}</p>
      )}
    </div>
  )
}
