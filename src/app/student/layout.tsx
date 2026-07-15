import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { MobileNav } from "@/components/layout/mobile-nav"
import { SocketProvider } from "@/components/providers/socket-provider"

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect("/")
  }

  if (session.user.role !== "STUDENT") {
    redirect(`/${session.user.role.toLowerCase()}/dashboard`)
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AppSidebar role="STUDENT" />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1 p-4 pb-20 md:p-6 md:pb-6">
          <SocketProvider>{children}</SocketProvider>
        </main>
        <Footer />
      </div>
      <MobileNav role="STUDENT" />
    </div>
  )
}
