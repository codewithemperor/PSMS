"use client"

import { memo } from "react"
import { motion } from "framer-motion"
import { Check, CheckCheck } from "lucide-react"
import { cn } from "@/lib/utils"

interface MessageBubbleProps {
  content: string
  createdAt: string
  isOwn: boolean
  isRead: boolean
  senderName?: string
  isConsecutive?: boolean
}

function formatMessageTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
}

function MessageBubbleBase({
  content,
  createdAt,
  isOwn,
  isRead,
  senderName,
  isConsecutive = false,
}: MessageBubbleProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className={cn(
        "flex w-full",
        isOwn ? "justify-end" : "justify-start",
        isConsecutive ? "mt-0.5" : "mt-3",
      )}
    >
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm",
          isOwn
            ? "bg-emerald-600 text-white rounded-br-md"
            : "bg-slate-100 text-slate-800 rounded-bl-md",
        )}
      >
        {!isOwn && !isConsecutive && senderName && (
          <p className="mb-1 text-xs font-semibold text-emerald-700">
            {senderName}
          </p>
        )}

        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
          {content}
        </p>

        <div className="mt-1 flex items-center justify-end gap-1">
          <span
            className={cn(
              "text-[10px]",
              isOwn ? "text-emerald-100" : "text-slate-400",
            )}
          >
            {formatMessageTime(createdAt)}
          </span>
          {isOwn &&
            (isRead ? (
              <CheckCheck className="size-3.5 text-emerald-100" />
            ) : (
              <Check className="size-3.5 text-emerald-200" />
            ))}
        </div>
      </div>
    </motion.div>
  )
}

export const MessageBubble = memo(MessageBubbleBase)
