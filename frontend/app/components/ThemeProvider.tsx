'use client'
import { createContext, useContext, useState, useEffect, useCallback } from 'react'

interface ThemeContextType {
  theme: 'light' | 'dark'
  toggle: () => void
  phase: 'idle' | 'falling' | 'rising'
}

export const ThemeCtx = createContext<ThemeContextType>({
  theme: 'light',
  toggle: () => {},
  phase: 'idle',
})

export function useTheme() { return useContext(ThemeCtx) }

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [phase, setPhase] = useState<'idle' | 'falling' | 'rising'>('idle')
  const [curtainColor, setCurtainColor] = useState('#141414')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const saved = localStorage.getItem('sipeduli-theme') as 'light' | 'dark' | null
      if (saved === 'dark' || saved === 'light') setTheme(saved)
    } catch (e) {}
  }, [])

  useEffect(() => {
    if (!mounted) return
    const root = document.documentElement
    if (theme === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
    try { localStorage.setItem('sipeduli-theme', theme) } catch (e) {}
  }, [theme, mounted])

  const toggle = useCallback(() => {
    if (phase !== 'idle') return
    const next = theme === 'light' ? 'dark' : 'light'
    setCurtainColor(next === 'dark' ? '#141414' : '#ffffff')
    setPhase('falling')
    setTimeout(() => {
      setTheme(next)
      setPhase('rising')
      setTimeout(() => setPhase('idle'), 600)
    }, 550)
  }, [phase, theme])

  return (
    <ThemeCtx.Provider value={{ theme, toggle, phase }}>
      <div
        className={`curtain ${phase === 'falling' ? 'falling' : phase === 'rising' ? 'rising' : ''}`}
        style={{ background: curtainColor }}
        aria-hidden="true"
      />
      {children}
    </ThemeCtx.Provider>
  )
}
