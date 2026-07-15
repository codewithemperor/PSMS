/**
 * Formatting helpers shared across the PSMS UI.
 */

/**
 * Returns the user's name prefixed with a human-readable role label.
 *
 * Examples:
 *   formatNameWithRole("Dr. Adewale", "ADMIN")      → "Admin - Dr. Adewale"
 *   formatNameWithRole("Prof. Chinedu", "SUPERVISOR") → "Supervisor - Prof. Chinedu"
 *   formatNameWithRole("James", "STUDENT")           → "Student - James"
 *   formatNameWithRole("James", undefined)           → "James"
 *
 * Used everywhere a chat partner's name is displayed so the role is always
 * visible (conversation list, chat window header, message dialog candidates).
 */
export function formatNameWithRole(
  name: string,
  role: string | undefined | null,
): string {
  if (!role) return name
  const prefix =
    role === "ADMIN" ? "Admin" : role === "SUPERVISOR" ? "Supervisor" : "Student"
  return `${prefix} - ${name}`
}
