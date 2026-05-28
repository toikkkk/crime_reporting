'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ThemeToggle } from '../../components/ThemeToggle'
import './login.css'

const VALID_CREDENTIALS = {
  username: 'admin',
  password: 'sipeduli2026',
}

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(false)

    await new Promise<void>(r => setTimeout(r, 1000))

    if (
      username.trim() === VALID_CREDENTIALS.username &&
      password === VALID_CREDENTIALS.password
    ) {
      localStorage.setItem(
        'sipeduli_admin',
        JSON.stringify({ isLoggedIn: true, user: 'admin' })
      )
      router.push('/admin/dashboard')
    } else {
      setLoading(false)
      setError(true)
    }
  }

  return (
    <div className="login-bg">

      <div className="login-toggle">
        <ThemeToggle />
      </div>

      {/* ── Logo ── */}
      <div className="login-logo">
        <div className="login-logo-row">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Logo SIPEDULI" width={32} height={32} style={{ objectFit: 'contain', borderRadius: '4px', flexShrink: 0 }} />
          <span className="login-logo-name">SIPEDULI</span>
        </div>
        <div className="login-logo-sub">Sistem Pelaporan Kejahatan Terpadu</div>
      </div>

      {/* ── Card ── */}
      <div className="login-card">
        <div className="login-card-tag">Portal Petugas</div>
        <div className="login-card-title">
          Masuk ke sistem<br />pelaporan
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {/* Username */}
          <div className="login-field">
            <label className="login-label" htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              className="login-input"
              placeholder="Masukkan username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          {/* Password */}
          <div className="login-field">
            <label className="login-label" htmlFor="password">Password</label>
            <div className="login-pw-wrap">
              <input
                id="password"
                type={showPw ? 'text' : 'password'}
                className="login-input pr"
                placeholder="Masukkan password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="login-eye"
                onClick={() => setShowPw(v => !v)}
                aria-label={showPw ? 'Sembunyikan password' : 'Tampilkan password'}
              >
                {showPw ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="login-error">
              Username atau password salah
            </div>
          )}

          {/* Submit */}
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? (
              <>
                <span className="login-spinner" />
                Memverifikasi...
              </>
            ) : (
              'Masuk ke Sistem'
            )}
          </button>
        </form>

        {/* Demo credentials */}
        <div className="login-demo">
          <div className="login-demo-label">Demo Credentials</div>
          <div className="login-demo-row">
            <span>Username:</span>
            <button
              type="button"
              className="login-demo-val"
              onClick={() => setUsername(VALID_CREDENTIALS.username)}
            >
              admin
            </button>
            <span className="login-demo-sep">·</span>
            <span>Password:</span>
            <button
              type="button"
              className="login-demo-val"
              onClick={() => setPassword(VALID_CREDENTIALS.password)}
            >
              sipeduli2026
            </button>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="login-footer">© 2026 SIPEDULI · Republik Indonesia</div>

    </div>
  )
}
