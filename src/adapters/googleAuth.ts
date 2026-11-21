/**
 * Google 登入轉接層（網頁版：Google Identity Services token client）。
 * iOS（Capacitor）不允許在 WebView 內做 Google OAuth，之後會換成原生登入外掛，
 * 只要提供同樣的 signIn / signOut / restore 介面即可。
 */
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '204399136099-jruoq7f7671gb2q56kvhflpkq69ertve.apps.googleusercontent.com'
const SCOPES = 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.profile'
const TOKEN_KEY = 'acacia_next_g_token'

interface TokenResponse {
  access_token?: string
  expires_in?: number
  error?: string
}
interface TokenClient {
  requestAccessToken: (o?: { prompt?: string }) => void
}
interface GoogleAccounts {
  oauth2: {
    initTokenClient: (cfg: { client_id: string; scope: string; callback: (r: TokenResponse) => void; error_callback?: (e: { type: string }) => void }) => TokenClient
    revoke: (token: string, done: () => void) => void
  }
}
declare global {
  interface Window {
    google?: { accounts: GoogleAccounts }
  }
}

let gisPromise: Promise<GoogleAccounts> | null = null
function loadGis(): Promise<GoogleAccounts> {
  gisPromise ??= new Promise((resolve, reject) => {
    if (window.google?.accounts) return resolve(window.google.accounts)
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => (window.google?.accounts ? resolve(window.google.accounts) : reject(new Error('GIS 載入失敗')))
    s.onerror = () => {
      gisPromise = null
      reject(new Error('GIS 載入失敗'))
    }
    document.head.appendChild(s)
  })
  return gisPromise
}

export interface StoredToken {
  token: string
  expiresAt: number
}

export function restoreToken(): StoredToken | null {
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY)
    if (!raw) return null
    const t = JSON.parse(raw) as StoredToken
    return t.expiresAt > Date.now() + 60_000 ? t : null
  } catch {
    return null
  }
}

export async function signIn(): Promise<StoredToken> {
  const accounts = await loadGis()
  return new Promise((resolve, reject) => {
    const client = accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (r) => {
        if (r.error || !r.access_token) return reject(new Error(r.error ?? 'no token'))
        const t = { token: r.access_token, expiresAt: Date.now() + (r.expires_in ?? 3600) * 1000 }
        try {
          sessionStorage.setItem(TOKEN_KEY, JSON.stringify(t))
        } catch {
          /* 無痕模式等情況可忽略 */
        }
        resolve(t)
      },
      error_callback: (e) => reject(new Error(e.type)),
    })
    client.requestAccessToken({ prompt: '' })
  })
}

export async function signOut(token: string | null) {
  try {
    sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
  if (!token) return
  const accounts = await loadGis().catch(() => null)
  accounts?.oauth2.revoke(token, () => {})
}

export interface GoogleProfile {
  name?: string
  picture?: string
}

export async function fetchProfile(token: string): Promise<GoogleProfile | null> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${token}` } })
  return res.ok ? ((await res.json()) as GoogleProfile) : null
}
