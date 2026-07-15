import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Academic / honorific title prefixes that should be stripped before deriving
// a first-name greeting. Without this, "Prof. Chinedu Eze".split(" ")[0]
// yields "Prof." instead of "Chinedu".
const TITLE_PREFIX_RE =
  /^(Prof\.|Dr\.|Mr\.|Mrs\.|Ms\.|Miss|Engr\.|Sir|Lady|Prof|Dr)\s+/i

/**
 * Returns a natural first-name greeting token from a full name, stripping
 * common academic / honorific title prefixes first.
 *
 *   preferredFirstName("Prof. Chinedu Eze") → "Chinedu"
 *   preferredFirstName("Dr. Amina Bello")    → "Amina"
 *   preferredFirstName("Sulaimon Yusuf")     → "Sulaimon"
 *   preferredFirstName(null)                 → "there"
 */
export function preferredFirstName(fullName?: string | null): string {
  if (!fullName) return "there"
  const stripped = fullName.replace(TITLE_PREFIX_RE, "").trim()
  if (!stripped) return fullName
  return stripped.split(/\s+/)[0]
}

