/** Browser session for Shihezu login. */

const TOKEN_KEY = "shihezu_token"
const USER_KEY = "shihezu_user"

const API_BASE =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) ||
  "http://127.0.0.1:8000"

export type SessionUser = {
  username: string
  role: string
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(TOKEN_KEY)
}

export function getUser(): SessionUser | null {
  if (typeof window === "undefined") return null
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as SessionUser
  } catch {
    return null
  }
}

export function setSession(token: string, user: SessionUser) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export async function login(username: string, password: string): Promise<SessionUser> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(text || "Invalid username or password")
  }
  const data = await res.json()
  const user = { username: data.username as string, role: data.role as string }
  setSession(data.access_token, user)
  return user
}

export async function logout(): Promise<void> {
  const token = getToken()
  try {
    if (token) {
      await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
    }
  } catch {
    /* ignore network */
  }
  clearSession()
}

export async function fetchMe(): Promise<SessionUser | null> {
  const token = getToken()
  if (!token) return null
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    clearSession()
    return null
  }
  const data = await res.json()
  const user = { username: data.username as string, role: data.role as string }
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  return user
}
