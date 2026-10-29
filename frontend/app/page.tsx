"use client"

import { useCallback, useEffect, useState } from "react"
import { FirewallDashboard } from "@/components/firewall-dashboard"
import { LoginPage } from "@/components/login-page"
import { fetchMe, getToken, logout as doLogout, type SessionUser } from "@/lib/auth"

export default function Page() {
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState<SessionUser | null>(null)

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null)
      setReady(true)
      return
    }
    const me = await fetchMe()
    setUser(me)
    setReady(true)
  }, [])

  useEffect(() => {
    void refresh()
    const onLost = () => {
      setUser(null)
    }
    window.addEventListener("shihezu-auth-lost", onLost)
    return () => window.removeEventListener("shihezu-auth-lost", onLost)
  }, [refresh])

  async function handleLogout() {
    await doLogout()
    setUser(null)
  }

  if (!ready) {
    return (
      <div className="login-shell">
        <p style={{ color: "#64748b" }}>Loading…</p>
      </div>
    )
  }

  if (!user) {
    return <LoginPage onSuccess={() => void refresh()} />
  }

  return <FirewallDashboard sessionUser={user} onLogout={() => void handleLogout()} />
}
