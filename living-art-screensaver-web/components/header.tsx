"use client"

import Link from "next/link"
import { User } from "lucide-react"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { DownloadCTA } from "@/components/marketing/download-cta"
import type { User as SupabaseUser } from "@supabase/supabase-js"

export function Header() {
  const [user, setUser] = useState<SupabaseUser | null>(null)

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <header
      className="fixed top-0 left-0 right-0 z-[100] border-b border-white/[0.07]"
      style={{
        backdropFilter: "blur(18px) saturate(1.3)",
        WebkitBackdropFilter: "blur(18px) saturate(1.3)",
        background: "rgba(10,10,11,0.72)",
      }}
    >
      <div className="mx-auto flex h-[68px] max-w-[1340px] items-center justify-between gap-3 px-4 sm:gap-6 sm:px-[30px]">
        <Link href="#top" className="flex items-center gap-[11px] no-underline">
          <span
            className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] bg-primary"
            style={{ boxShadow: "0 4px 14px -3px rgba(158,232,162,0.6)" }}
          >
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary-foreground">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </span>
          <span className="hidden text-[16px] font-semibold tracking-[-0.01em] text-foreground sm:inline">Living Art Screensaver</span>
        </Link>

        <div className="flex shrink-0 items-center gap-[14px]">
          {user ? (
            <Link href="/account" className="flex items-center gap-1.5 whitespace-nowrap text-[14.5px] font-medium text-muted-foreground no-underline transition-colors hover:text-foreground">
              <User className="h-4 w-4" />
              Account
            </Link>
          ) : (
            <Link href="/auth/login" className="whitespace-nowrap text-[14.5px] font-medium text-muted-foreground no-underline transition-colors hover:text-foreground">
              Sign in
            </Link>
          )}
          <DownloadCTA
            location="header"
            mobileLabel="Get the app"
            iconClassName="h-3.5 w-3.5"
            className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-full bg-primary px-[18px] py-[10px] text-[14.5px] font-semibold text-primary-foreground no-underline"
            style={{ boxShadow: "0 6px 22px -8px rgba(158,232,162,0.55)" }}
          />
        </div>
      </div>
    </header>
  )
}
