'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ThemeToggle } from './components/ThemeToggle'

/* ============================================================
   TYPES
   ============================================================ */
interface RevealOptions { threshold?: number; rootMargin?: string }
type BadgeKind = 'tinggi' | 'sedang' | 'rendah'
interface StatusEntry { stage: number; kind: BadgeKind; cat: string; loc: string; updated: string; officer: string }

/* ============================================================
   HOOKS
   ============================================================ */
function useReveal(options: RevealOptions = {}): [React.RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (!ref.current || shown) return
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) { setShown(true); obs.disconnect() } }),
      { threshold: options.threshold ?? 0.18, rootMargin: options.rootMargin ?? '0px 0px -40px 0px' }
    )
    obs.observe(ref.current)
    return () => obs.disconnect()
  }, [shown, options.threshold, options.rootMargin])
  return [ref, shown]
}

function useScrollProgress(ref: React.RefObject<HTMLElement | null>): number {
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        if (ref.current) {
          const rect  = ref.current.getBoundingClientRect()
          const total = rect.height + window.innerHeight
          const trvl  = window.innerHeight - rect.top
          setProgress(Math.max(0, Math.min(1, trvl / total)))
        }
        ticking = false
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll) }
  }, [])
  return progress
}

function smoothScrollTo(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 70, behavior: 'smooth' })
}

/* ============================================================
   ATOMS
   ============================================================ */
function LogoBox({ size = 32 }: { size?: number; light?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/logo.png" alt="Logo SIPEDULI" className="shrink-0 r4"
      style={{ width: size, height: size, objectFit: 'contain', display: 'inline-block' }} />
  )
}

function Badge({ kind = 'tinggi', children }: { kind?: BadgeKind; children: React.ReactNode }) {
  const s: Record<BadgeKind, string> = { tinggi: 'bg-alert text-white', sedang: 'bg-ink text-white', rendah: 'bg-gray-200 text-ink' }
  return <span className={`mono text-[11px] font-bold tracking-[0.08em] uppercase px-2 py-1 r4 ${s[kind]}`}>{children}</span>
}

function RedLabel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`text-alert text-[12px] font-bold tracking-[0.18em] uppercase ${className}`}>{children}</div>
}

function TypewriterLoop({ phrases, delay = 1200, speed = 75, deleteSpeed = 38, pauseMs = 2400, className = '' }: {
  phrases: string[]; delay?: number; speed?: number; deleteSpeed?: number; pauseMs?: number; className?: string
}) {
  const [displayed, setDisplayed] = useState('')
  const [active, setActive]       = useState(false)
  const [idx, setIdx]             = useState(0)
  const [phase, setPhase]         = useState<'typing' | 'deleting'>('typing')

  useEffect(() => {
    const t = setTimeout(() => setActive(true), delay)
    return () => clearTimeout(t)
  }, [delay])

  useEffect(() => {
    if (!active) return
    const target = phrases[idx]

    if (phase === 'typing') {
      if (displayed.length < target.length) {
        const t = setTimeout(() => setDisplayed(target.slice(0, displayed.length + 1)), speed)
        return () => clearTimeout(t)
      }
      const t = setTimeout(() => setPhase('deleting'), pauseMs)
      return () => clearTimeout(t)
    }

    if (phase === 'deleting') {
      if (displayed.length > 0) {
        const t = setTimeout(() => setDisplayed(d => d.slice(0, -1)), deleteSpeed)
        return () => clearTimeout(t)
      }
      setIdx(i => (i + 1) % phrases.length)
      setPhase('typing')
    }
  }, [active, displayed, phase, idx, phrases, speed, deleteSpeed, pauseMs])

  return (
    <span className={`${className} ${active ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}>
      {displayed}
      <span className="inline-block bg-current blink"
        style={{ width: '4px', height: '0.78em', marginLeft: '4px', verticalAlign: 'middle' }}
        aria-hidden="true" />
    </span>
  )
}

function MagneticButton({ children, onClick, variant = 'primary', className = '' }: { children: React.ReactNode; onClick?: () => void; variant?: 'primary' | 'ghost'; className?: string }) {
  const base = 'r4 inline-flex items-center justify-center font-bold text-[14px] tracking-[0.04em] uppercase px-7 py-4 relative overflow-hidden group hover:-translate-y-0.5 active:translate-y-0'
  if (variant === 'ghost') {
    return (
      <button onClick={onClick} className={`${base} bg-white text-ink border border-ink ${className}`}>
        <span className="btn-sw-g absolute inset-0 translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-300 ease-out" aria-hidden="true" />
        <span className="relative z-10 btn-ghost-lbl">{children}</span>
      </button>
    )
  }
  return (
    <button onClick={onClick} className={`${base} bg-ink text-white ${className}`}>
      <span className="btn-sw-p absolute inset-0 translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-300 ease-out" aria-hidden="true" />
      <span className="relative z-10">{children}</span>
    </button>
  )
}

/* ============================================================
   NAVBAR
   ============================================================ */
function Navbar({ onCTA }: { onCTA: () => void }) {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200 headerDrop">
      <div className="max-w-[1240px] mx-auto px-6 h-[68px] flex items-center justify-between">
        <a href="#beranda" onClick={e => { e.preventDefault(); smoothScrollTo('beranda') }} className="flex items-center gap-3">
          <LogoBox />
          <span className="font-bold tracking-[0.08em] text-[15px]">SIPEDULI</span>
          <span className="hidden md:inline mono text-[10px] tracking-[0.16em] uppercase text-gray-500 border-l border-gray-200 pl-3 ml-1">
            Sistem Pelaporan Kejahatan Terpadu
          </span>
        </a>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button onClick={onCTA}
            className="r4 hidden sm:inline-flex items-center justify-center bg-ink text-white font-bold text-[14px] tracking-[0.04em] uppercase px-5 py-3 relative overflow-hidden group hover:-translate-y-0.5 active:translate-y-0 btnPress">
            <span className="btn-sw-p absolute inset-0 translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-300 ease-out" aria-hidden="true" />
            <span className="relative z-10">Laporkan Sekarang</span>
          </button>
        </div>
      </div>
    </header>
  )
}

/* ============================================================
   HERO
   ============================================================ */
function Hero({ onReport, onTrack }: { onReport: () => void; onTrack: () => void }) {
  return (
    <section id="beranda" className="bg-gray-50 relative overflow-hidden">
      <div className="hero-grid absolute inset-0 pointer-events-none" aria-hidden="true">
        <span className="grid-sq alert" style={{ top: '28%', left: '18%' }} />
        <span className="grid-sq"      style={{ top: '55%', left: '6%' }} />
        <span className="grid-sq alert" style={{ top: '20%', right: '14%' }} />
        <span className="grid-sq"      style={{ bottom: '22%', right: '20%' }} />
      </div>
      <div className="max-w-[900px] mx-auto px-6 pt-20 md:pt-32 pb-8 md:pb-12 text-center relative z-10">
        <div className="heroAnim flex flex-col items-center">
          <RedLabel className="mb-8"><span className="redLabel">SISTEM PELAPORAN KEJAHATAN TERPADU</span></RedLabel>
          <h1 className="heroTitle uppercase leading-none tracking-[0.01em] text-[60px] md:text-[100px]"
              style={{ fontFamily: 'var(--font-display), sans-serif' }}>
            <span className="word delay-1">Laporkan</span><br />
            <TypewriterLoop
              phrases={['Kami Tindak', 'Kami Catat', 'Kami Proses', 'Kami Lindungi']}
              delay={400}
              className="text-alert"
            />
          </h1>
          <p className="mt-8 text-gray-600 text-[17px] md:text-[18px] leading-[1.55] max-w-[560px] mx-auto">
            Platform pelaporan kejahatan resmi yang terhubung langsung dengan aparat berwenang.
            Setiap laporan dianalisis dan diprioritaskan secara otomatis.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <MagneticButton onClick={onReport} variant="primary">Buat Laporan</MagneticButton>
            <MagneticButton onClick={onTrack}  variant="ghost">Cek Status Laporan</MagneticButton>
          </div>
          <div className="mt-6 flex items-center gap-2 text-[12px] text-gray-500">
            <span className="inline-block w-[6px] h-[6px] bg-gray-400" />
            Laporan bersifat rahasia. Identitas pelapor dilindungi.
          </div>
          <div className="mt-12 inline-flex items-center gap-4 border border-gray-200 bg-white r4 px-6 py-3">
            <span className="mono text-[10px] uppercase tracking-[0.18em] text-gray-500 font-bold">DARURAT</span>
            <span className="font-bold text-[22px] text-alert leading-none">110</span>
            <span className="text-[12px] text-gray-600 hidden sm:inline">Untuk situasi mengancam nyawa</span>
          </div>
        </div>

      </div>
    </section>
  )
}

/* ============================================================
   STATS BAR
   ============================================================ */
function StatsBar() {
  const stats = [
    { value: '2.413',    label: 'Kasus Teranalisis',      sub: 'Dataset training AI' },
    { value: '< 60 dtk', label: 'Klasifikasi Otomatis',   sub: 'Setiap laporan masuk' },
    { value: '91%',      label: 'Akurasi Model',           sub: 'R² pada data uji' },
    { value: '24/7',     label: 'Operasional',             sub: 'Tanpa henti' },
  ]
  return (
    <section className="bg-white border-y border-gray-200">
      <div className="max-w-[1240px] mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4">
          {stats.map((s, i) => (
            <div key={s.label}
              className={`py-10 px-6 flex flex-col gap-1 ${i < stats.length - 1 ? 'border-r border-gray-200' : ''}`}>
              <div className="font-bold text-[36px] md:text-[44px] leading-none tracking-[-0.02em]"
                   style={{ fontFamily: 'var(--font-display), sans-serif' }}>
                {s.value}
              </div>
              <div className="font-bold text-[14px] mt-2">{s.label}</div>
              <div className="mono text-[10px] uppercase tracking-[0.14em] text-gray-500">{s.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ============================================================
   HOW IT WORKS
   ============================================================ */
function HowItWorks() {
  const steps = [
    { n: '01', t: 'Tulis laporan',   d: 'Isi formulir aman dengan kronologi, lokasi, waktu, dan bukti pendukung. Anda dapat memilih melapor secara anonim atau dengan identitas terverifikasi.', meta: 'WAKTU: 3–5 MENIT'  },
    { n: '02', t: 'AI menganalisis', d: 'Sistem klasifikasi otomatis menilai jenis kejahatan, urgensi, dan wilayah penanganan, lalu meneruskan laporan ke unit kepolisian yang tepat.',              meta: 'PROSES: < 60 DETIK' },
    { n: '03', t: 'Polisi bertindak',d: 'Petugas yang ditugaskan menerima berkas lengkap dan melakukan tindak lanjut. Anda menerima pembaruan status di setiap tahap penyelidikan.',                meta: 'TINJAU: 24 JAM'    },
  ]
  const [hdrRef, hdrShown] = useReveal()
  const [grdRef, grdShown] = useReveal({ threshold: 0.12 })
  const scrollRef = useRef<HTMLDivElement>(null)
  const prog = useScrollProgress(scrollRef as React.RefObject<HTMLElement>)
  const ep = Math.min(1, prog / 0.5)
  const isMob = typeof window !== 'undefined' && window.innerWidth <= 768
  const rot   = (isMob ? 10 : 15) * (1 - ep)
  const sc    = isMob ? 0.92 + 0.08 * ep : 1.04 - 0.04 * ep

  return (
    <section id="cara-kerja" className="bg-white">
      <div ref={scrollRef} className="max-w-[1240px] mx-auto px-6 py-20 md:py-28">
        <div ref={hdrRef} className={`max-w-[760px] reveal up ${hdrShown ? 'in' : ''}`}
          style={{ transform: `translateY(${-32 * ep}px)`, transition: 'transform .15s linear', willChange: 'transform' }}>
          <RedLabel className="mb-5"><span className="redLabel">ALUR PELAPORAN</span></RedLabel>
          <h2 className="font-bold text-[44px] md:text-[56px] leading-[1.02] tracking-[-0.02em]">Tiga langkah mudah</h2>
          <p className="mt-5 text-gray-600 text-[16px] leading-[1.6] max-w-[600px]">
            Proses pelaporan dirancang singkat dan transparan agar siapa pun dapat melapor tanpa hambatan birokrasi.
          </p>
        </div>
        <div className="cs-wrap mt-14">
          <div ref={grdRef} className="grid md:grid-cols-3 border-y border-gray-200 cs-card"
            style={{ '--cs-rot': rot + 'deg', '--cs-scale': sc, transition: 'transform .15s linear' } as React.CSSProperties}>
            {steps.map((s, i) => (
              <div key={s.n}
                className={`p-8 md:p-10 reveal up ${grdShown ? 'in' : ''} ${i < 2 ? 'md:border-r border-b md:border-b-0 border-gray-200' : ''}`}
                style={{ transitionDelay: `${i * 0.15}s` }}>
                <div className="flex items-baseline justify-between">
                  <div className="text-alert font-bold text-[64px] md:text-[80px] leading-none tracking-[-0.04em] stepFlip">{s.n}</div>
                  <div className="mono text-[10px] uppercase tracking-[0.18em] text-gray-500">{s.meta}</div>
                </div>
                <div className="mt-6 font-bold text-[22px] tracking-[-0.01em]">{s.t}</div>
                <p className="mt-3 text-gray-600 text-[14.5px] leading-[1.6]">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ============================================================
   URGENCY SYSTEM
   ============================================================ */
function UrgencySystem() {
  const cards = [
    { border: '#cc0000', tag: 'TINGGI', title: 'PRIORITAS TINGGI', desc: 'Kejahatan dengan kekerasan, ancaman langsung terhadap nyawa, atau yang sedang berlangsung. Diteruskan ke unit reaksi cepat.',    sla: 'Respons dalam 2 jam',  examples: ['Penyerangan','Perampokan bersenjata','KDRT aktif'] },
    { border: '#0a0a0a', tag: 'SEDANG', title: 'PRIORITAS SEDANG', desc: 'Kejahatan terhadap harta benda atau pelanggaran serius tanpa risiko nyawa langsung. Ditugaskan ke unit reskrim wilayah.',          sla: 'Respons dalam 24 jam', examples: ['Pencurian','Penipuan online','Pengrusakan'] },
    { border: '#9ca3af', tag: 'RENDAH', title: 'PRIORITAS RENDAH', desc: 'Pelanggaran ketertiban umum dan laporan informatif. Ditangani melalui kanal administratif dan patroli rutin.',                     sla: 'Respons dalam 72 jam', examples: ['Kebisingan','Parkir liar','Vandalisme ringan'] },
  ]
  const [hdrRef, hdrShown] = useReveal()
  const [crdRef, crdShown] = useReveal({ threshold: 0.12 })
  const scrollRef = useRef<HTMLDivElement>(null)
  const prog = useScrollProgress(scrollRef as React.RefObject<HTMLElement>)
  const ep   = Math.min(1, prog / 0.5)
  const isMob = typeof window !== 'undefined' && window.innerWidth <= 768
  const rot  = (isMob ? 12 : 18) * (1 - ep)
  const sc   = isMob ? 0.9 + 0.1 * ep : 1.05 - 0.05 * ep

  return (
    <section className="bg-gray-100">
      <div ref={scrollRef} className="max-w-[1240px] mx-auto px-6 py-20 md:py-28">
        <div ref={hdrRef} className={`grid md:grid-cols-12 gap-8 items-end reveal up ${hdrShown ? 'in' : ''}`}
          style={{ transform: `translateY(${-40 * ep}px)`, transition: 'transform .15s linear', willChange: 'transform' }}>
          <div className="md:col-span-7">
            <RedLabel className="mb-5"><span className="redLabel">SISTEM PRIORITAS</span></RedLabel>
            <h2 className="font-bold text-[44px] md:text-[56px] leading-[1.02] tracking-[-0.02em]">Setiap laporan dinilai otomatis</h2>
          </div>
          <div className="md:col-span-5 text-gray-600 text-[15.5px] leading-[1.6]">
            Algoritma penilaian menggabungkan jenis tindak pidana, lokasi geografis, riwayat kasus serupa, dan tingkat ancaman untuk menentukan kelas prioritas.
          </div>
        </div>
        <div className="cs-wrap mt-12">
          <div ref={crdRef} className="grid md:grid-cols-3 gap-5 cs-card"
            style={{ '--cs-rot': rot + 'deg', '--cs-scale': sc, transition: 'transform .15s linear' } as React.CSSProperties}>
            {cards.map((c, i) => (
              <div key={c.title} className={`bg-white r4 lift reveal up ${crdShown ? 'in' : ''}`}
                style={{ borderTop: `3px solid ${c.border}`, transitionDelay: `${i * 0.12}s` }}>
                <div className="px-7 pt-7 pb-2 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <span className="mono text-[11px] tracking-[0.16em] font-bold" style={{ color: c.border }}>{c.tag}</span>
                    <span className="mono text-[10px] tracking-[0.18em] uppercase text-gray-500">SLA</span>
                  </div>
                  <div className="mt-3 font-bold text-[22px] tracking-[-0.01em]">{c.title}</div>
                </div>
                <div className="px-7 py-6">
                  <p className="text-gray-600 text-[14.5px] leading-[1.6]">{c.desc}</p>
                  <div className="mt-6 mono text-[10px] uppercase tracking-[0.18em] text-gray-500">CONTOH KASUS</div>
                  <ul className="mt-2 space-y-1">
                    {c.examples.map(ex => (
                      <li key={ex} className="flex items-center gap-2 text-[14px]">
                        <span className="inline-block w-[6px] h-[6px] bg-ink" />{ex}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="px-7 py-4 border-t border-gray-200 flex items-center justify-between">
                  <span className="font-bold text-[14px]">{c.sla}</span>
                  <span className="mono text-[11px] uppercase tracking-[0.18em] text-gray-500">→</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ============================================================
   STATUS TRACKER
   ============================================================ */
interface DbLaporanPublic {
  ticket_id: string
  judul: string | null
  lokasi: string | null
  prediksi_urgensi: string | null
  status: string
  created_at: string
  updated_at: string
  catatan_petugas: string | null
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'baru saja'
  if (mins < 60) return `${mins} menit lalu`
  const h = Math.floor(mins / 60)
  if (h < 24)    return `${h} jam lalu`
  return `${Math.floor(h / 24)} hari lalu`
}

function dbToStatusEntry(row: DbLaporanPublic): StatusEntry & { ticketId: string; catatan: string | null } {
  const stageMap: Record<string, number> = {
    'Diterima': 0, 'Dianalisis': 1, 'Dalam Penyelidikan': 2, 'Selesai': 3, 'Ditolak': 3,
  }
  const kindMap: Record<string, BadgeKind> = { 'Tinggi': 'tinggi', 'Sedang': 'sedang', 'Rendah': 'rendah' }
  return {
    ticketId: row.ticket_id,
    stage:    stageMap[row.status] ?? 0,
    kind:     kindMap[row.prediksi_urgensi ?? ''] ?? 'rendah',
    cat:      row.judul || '-',
    loc:      row.lokasi || '-',
    updated:  timeAgo(row.updated_at || row.created_at),
    officer:  'Petugas SIPEDULI',
    catatan:  row.catatan_petugas ?? null,
  }
}

function Tracker() {
  const [q,          setQ]          = useState('')
  const [result,     setResult]     = useState<(StatusEntry & { ticketId: string; catatan: string | null }) | null>(null)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')
  const [examples,   setExamples]   = useState<string[]>([])
  const steps = [
    { label: 'Diterima',     meta: 'Laporan tersimpan'    },
    { label: 'Dianalisis',   meta: 'Klasifikasi AI'       },
    { label: 'Penyelidikan', meta: 'Tindak lanjut polisi' },
    { label: 'Selesai',      meta: 'Berkas ditutup'       },
  ]
  const [hdrRef, hdrShown] = useReveal()
  useReveal({ threshold: 0.25 })

  // Load 3 most-recent ticket IDs as examples
  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    fetch(`${apiUrl}/api/laporan?limit=3`)
      .then(r => r.json())
      .then(json => {
        const ids: string[] = (json.data as DbLaporanPublic[]).map(r => r.ticket_id).filter(Boolean)
        setExamples(ids)
      })
      .catch(() => {/* silent — examples are optional */})
  }, [])

  const lookup = async (ticketId: string) => {
    const key = ticketId.trim().toUpperCase()
    if (!key) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const res = await fetch(`${apiUrl}/api/laporan/${encodeURIComponent(key)}`)
      if (res.status === 404) {
        setError(`Nomor laporan tidak ditemukan. Pastikan nomor yang Anda masukkan sesuai (contoh: CRM-2026-0001).`)
        return
      }
      if (!res.ok) throw new Error('Gagal menghubungi server')
      const row: DbLaporanPublic = await res.json()
      setResult(dbToStatusEntry(row))
    } catch {
      setError('Terjadi kesalahan saat menghubungi server. Coba beberapa saat lagi.')
    } finally {
      setLoading(false)
    }
  }

  const submit = (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); lookup(q) }

  return (
    <section id="cek-status" className="bg-white">
      <div className="max-w-[1240px] mx-auto px-6 py-20 md:py-28">
        <div ref={hdrRef} className={`grid md:grid-cols-12 gap-8 items-end reveal up ${hdrShown ? 'in' : ''}`}>
          <div className="md:col-span-8">
            <RedLabel className="mb-5"><span className="redLabel">PELACAKAN LAPORAN</span></RedLabel>
            <h2 className="font-bold text-[44px] md:text-[56px] leading-[1.02] tracking-[-0.02em]">Cek status laporan Anda</h2>
          </div>
          <div className="md:col-span-4 text-gray-600 text-[15px] leading-[1.6]">
            Masukkan nomor laporan yang Anda terima saat pengiriman untuk melihat tahapan terkini.
          </div>
        </div>

        <form onSubmit={submit} className="mt-10 border border-ink r4 flex flex-col md:flex-row focus-within:shadow-[0_0_0_3px_rgba(204,0,0,0.12)]">
          <div className="flex-1 flex items-center px-5 py-4 gap-4">
            <span className="mono text-[11px] uppercase tracking-[0.18em] text-gray-500 hidden sm:inline">NO. LAPORAN</span>
            <input type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="Contoh: CRM-2026-0001"
              className="mono w-full bg-transparent text-[15px] font-bold tracking-[0.04em] outline-none" />
          </div>
          <button type="submit" disabled={loading}
            className="bg-ink text-white font-bold text-[13px] tracking-[0.18em] uppercase px-7 py-4 hover:bg-black disabled:opacity-60">
            {loading ? 'MENCARI...' : 'CEK STATUS'}
          </button>
        </form>
        {error && <div className="mt-3 mono text-[12px] text-alert uppercase tracking-[0.12em]">{error}</div>}

        {/* Result panel — only shown after a successful lookup */}
        {result && (
          <div className="mt-10 border border-gray-200 r4 bg-white overflow-hidden">

            {/* ── Status banner ── */}
            <div className="bg-ink keep-ink px-6 py-4 flex flex-wrap items-center gap-3">
              <span className="mono text-[10px] uppercase tracking-[0.18em] text-white/50 shrink-0">STATUS SAAT INI</span>
              <span className={`mono text-[11px] font-bold px-3 py-1 r4 uppercase text-white ${
                result.stage === 3 ? 'bg-green-600' : 'bg-alert'
              }`}>
                {steps[result.stage]?.label}
              </span>
              <span className="mono text-[11px] text-white/40 ml-auto">
                LANGKAH {result.stage + 1} DARI {steps.length}
              </span>
              <span className="w-px h-4 bg-white/20 hidden sm:block" />
              <span className="mono text-[11px] text-white/50 hidden sm:block">{result.updated}</span>
            </div>

            {/* ── Info row ── */}
            <div className="grid md:grid-cols-3 border-b border-gray-200">
              <div className="px-6 py-5 md:border-r border-b md:border-b-0 border-gray-200">
                <div className="mono text-[10px] uppercase tracking-[0.18em] text-gray-500">NO. LAPORAN</div>
                <div className="mt-2 mono font-bold text-[15px]">{result.ticketId}</div>
              </div>
              <div className="px-6 py-5 md:border-r border-b md:border-b-0 border-gray-200">
                <div className="mono text-[10px] uppercase tracking-[0.18em] text-gray-500">JUDUL LAPORAN</div>
                <div className="mt-2 font-bold text-[15px]">{result.cat}</div>
              </div>
              <div className="px-6 py-5">
                <div className="mono text-[10px] uppercase tracking-[0.18em] text-gray-500">LOKASI KEJADIAN</div>
                <div className="mt-2 font-bold text-[15px]">{result.loc}</div>
              </div>
            </div>

            {/* ── Timeline ── */}
            <div className="px-6 md:px-10 pt-8 pb-10">

              {/* Progress bar */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-2">
                  <span className="mono text-[10px] uppercase tracking-[0.18em] text-gray-500">PROGRES PENANGANAN</span>
                  <span className="mono text-[11px] font-bold">
                    {Math.round(((result.stage + 1) / steps.length) * 100)}%
                  </span>
                </div>
                <div className="h-[3px] bg-gray-100 r4 overflow-hidden">
                  <div
                    className="h-full bg-ink transition-all duration-700 ease-out"
                    style={{ width: `${((result.stage + 1) / steps.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* Step nodes */}
              <div className="relative">
                {/* Gray track */}
                <div className="absolute h-[2px] bg-gray-200"
                  style={{ top: 20, left: 'calc(12.5%)', right: 'calc(12.5%)' }} />
                {/* Filled track */}
                <div
                  className="absolute h-[2px] bg-ink transition-all duration-700 ease-out"
                  style={{
                    top: 20,
                    left: 'calc(12.5%)',
                    width: result.stage === 0
                      ? '0%'
                      : `${(result.stage / (steps.length - 1)) * 75}%`,
                  }}
                />

                <div className="grid grid-cols-4 relative z-10">
                  {steps.map((s, i) => {
                    const filled  = i < result.stage
                    const current = i === result.stage
                    const pending = i > result.stage
                    return (
                      <div key={s.label} className="flex flex-col items-center text-center px-1">

                        {/* Node */}
                        <div
                          className={`flex items-center justify-center font-bold text-white r4 transition-all duration-500 ${
                            current ? 'w-10 h-10 text-[15px] ringPulse' : 'w-8 h-8 text-[12px]'
                          }`}
                          style={{
                            background: filled ? '#0a0a0a' : current ? '#cc0000' : '#ffffff',
                            border: `2px solid ${filled ? '#0a0a0a' : current ? '#cc0000' : '#d1d5db'}`,
                            boxShadow: current ? '0 0 0 4px rgba(204,0,0,0.12)' : 'none',
                          }}
                        >
                          {filled  && '✓'}
                          {current && '●'}
                        </div>

                        {/* Step label */}
                        <div className={`mt-3 text-[13px] leading-tight font-bold ${
                          current ? 'text-alert' : filled ? 'text-ink' : 'text-gray-300'
                        }`}>
                          {s.label}
                        </div>

                        {/* "SAAT INI" indicator */}
                        {current && (
                          <div className="mt-1 mono text-[9px] uppercase tracking-widest text-alert font-bold">
                            ▲ SAAT INI
                          </div>
                        )}

                        <div className={`mt-1 mono text-[10px] uppercase tracking-[0.12em] ${
                          pending ? 'text-gray-300' : 'text-gray-400'
                        }`}>
                          {s.meta}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Bottom info */}
              <div className="mt-10 grid md:grid-cols-3 gap-0 border-t border-gray-200 pt-6">
                <div className="md:pr-6">
                  <div className="mono text-[10px] uppercase tracking-[0.18em] text-gray-500">PETUGAS PENANGANAN</div>
                  <div className="mt-2 font-bold text-[15px]">{result.officer}</div>
                  <div className="mt-1 mono text-[10px] text-gray-400">{result.updated}</div>
                </div>
                <div className="md:px-6 md:border-l border-gray-200 mt-6 md:mt-0">
                  <div className="mono text-[10px] uppercase tracking-[0.18em] text-gray-500">PRIORITAS</div>
                  <div className="mt-2">
                    <Badge kind={result.kind}>
                      {result.kind === 'tinggi' ? 'TINGGI' : result.kind === 'sedang' ? 'SEDANG' : 'RENDAH'}
                    </Badge>
                  </div>
                </div>
                <div className="md:pl-6 md:border-l border-gray-200 mt-6 md:mt-0">
                  <div className="mono text-[10px] uppercase tracking-[0.18em] text-gray-500">TINDAKAN ANDA</div>
                  <div className="mt-2 font-bold text-[15px]">Tambahkan informasi atau bukti baru</div>
                  <Link href="/laporan" className="mt-2 mono text-[11px] uppercase tracking-[0.18em] font-bold underline underline-offset-4">
                    LAPORAN BARU →
                  </Link>
                </div>
              </div>

              {/* Catatan Petugas */}
              {result.catatan && (
                <div className="mt-8 border-t border-gray-200 pt-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="mono text-[10px] uppercase tracking-[0.18em] text-gray-500">CATATAN PETUGAS</div>
                    <span className="inline-block w-[6px] h-[6px] bg-ink" />
                  </div>
                  <div className="bg-gray-50 border border-gray-200 r4 px-5 py-4">
                    <p className="text-[15px] leading-[1.65] text-gray-700 whitespace-pre-wrap">{result.catatan}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Empty state — shown before any lookup */}
        {!result && !loading && !error && (
          <div className="mt-10 border border-dashed border-gray-300 r4 py-14 flex flex-col items-center justify-center text-center">
            <div className="mono text-[11px] uppercase tracking-[0.18em] text-gray-400">MASUKKAN NOMOR LAPORAN DI ATAS</div>
            <div className="mt-2 text-gray-500 text-[14px]">Nomor laporan diterima saat pengiriman laporan berhasil (format: CRM-TTTT-NNNN)</div>
          </div>
        )}

        {examples.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="mono text-[11px] uppercase tracking-[0.18em] text-gray-500">CONTOH:</span>
            {examples.map(id => (
              <button key={id} onClick={() => { setQ(id); lookup(id) }}
                className={`mono text-[12px] font-bold px-3 py-1 r4 border ${result?.ticketId === id ? 'bg-ink text-white border-ink' : 'border-gray-300 hover:border-ink'}`}>
                {id}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

/* ============================================================
   FAQ
   ============================================================ */
function FAQ() {
  const items = [
    { q: 'Apakah identitas saya dilindungi?',        a: 'Ya. Anda dapat melapor secara anonim. Jika Anda memberikan identitas, data tersebut dienkripsi dan hanya dapat diakses oleh petugas berwenang sesuai UU Perlindungan Data Pribadi.' },
    { q: 'Berapa lama proses penanganan laporan?',   a: 'Tergantung tingkat prioritas: 2 jam untuk tinggi, 24 jam untuk sedang, dan 72 jam untuk rendah. Anda akan menerima pembaruan setiap kali status berubah.' },
    { q: 'Apa bedanya dengan menelepon 110?',        a: 'Untuk situasi darurat yang sedang berlangsung, hubungi 110. SIPEDULI ditujukan untuk laporan terstruktur dengan bukti yang dapat ditelusuri dan dipantau pelapor.' },
    { q: 'Bisakah saya melampirkan foto atau video?',a: 'Bisa. Anda dapat mengunggah hingga 10 berkas (foto, video, atau dokumen) per laporan dengan total ukuran maksimum 200 MB.' },
    { q: 'Bagaimana laporan palsu ditangani?',       a: 'Sistem mendeteksi pola laporan palsu dan menandainya untuk peninjauan manual. Pelaporan palsu yang disengaja dapat dikenakan sanksi sesuai pasal 220 KUHP.' },
    { q: 'Apakah layanan ini gratis?',               a: 'Sepenuhnya gratis. SIPEDULI dibiayai oleh negara dan tidak mengenakan biaya apa pun kepada pelapor.' },
  ]
  const [open, setOpen]    = useState(0)
  const [hdrRef, hdrShown] = useReveal()
  const [lstRef, lstShown] = useReveal({ threshold: 0.1 })
  const scrollRef = useRef<HTMLDivElement>(null)
  const prog  = useScrollProgress(scrollRef as React.RefObject<HTMLElement>)
  const ep    = Math.min(1, prog / 0.5)
  const isMob = typeof window !== 'undefined' && window.innerWidth <= 768
  const rot   = (isMob ? 8 : 12) * (1 - ep)
  const sc    = isMob ? 0.94 + 0.06 * ep : 1.03 - 0.03 * ep

  return (
    <section id="faq" className="bg-white border-t border-gray-200">
      <div ref={scrollRef} className="max-w-[1240px] mx-auto px-6 py-20 md:py-28 grid md:grid-cols-12 gap-12">
        <div ref={hdrRef} className={`md:col-span-4 reveal up ${hdrShown ? 'in' : ''}`}
          style={{ transform: `translateY(${-28 * ep}px)`, transition: 'transform .15s linear', willChange: 'transform' }}>
          <RedLabel className="mb-5"><span className="redLabel">PERTANYAAN UMUM</span></RedLabel>
          <h2 className="font-bold text-[40px] md:text-[48px] leading-[1.02] tracking-[-0.02em]">Hal yang sering ditanyakan</h2>
          <p className="mt-5 text-gray-600 text-[15px] leading-[1.6]">
            Tidak menemukan jawabannya? Hubungi pusat bantuan di<span className="mono font-bold"> bantuan@sipeduli.go.id</span>.
          </p>
        </div>
        <div ref={lstRef} className="md:col-span-8 border-t border-gray-200 cs-card"
          style={{ '--cs-rot': rot + 'deg', '--cs-scale': sc, transition: 'transform .15s linear' } as React.CSSProperties}>
          {items.map((it, i) => (
            <div key={i} className={`border-b border-gray-200 reveal up ${lstShown ? 'in' : ''}`} style={{ transitionDelay: `${i * 0.06}s` }}>
              <button className="w-full text-left flex items-start justify-between gap-6 py-6 hover:text-alert"
                onClick={() => setOpen(open === i ? -1 : i)}>
                <div className="flex items-start gap-5">
                  <span className="mono text-[12px] font-bold text-gray-400 mt-1">0{i + 1}</span>
                  <span className="font-bold text-[18px] tracking-[-0.01em]">{it.q}</span>
                </div>
                <span className="mono text-[18px] font-bold shrink-0 transition-transform duration-300"
                  style={{ transform: open === i ? 'rotate(180deg)' : 'rotate(0)' }}>
                  {open === i ? '−' : '+'}
                </span>
              </button>
              <div className={`faqBody ${open === i ? 'open' : ''}`}>
                <div><div className="pb-6 pl-[44px] pr-10 text-gray-600 text-[15px] leading-[1.65] max-w-[640px]">{it.a}</div></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ============================================================
   FOOTER
   ============================================================ */
function Footer() {
  const layanan   = [['Buat Laporan', '/laporan'], ['Cek Status', '#cek-status'], ['Lapor Anonim', '/laporan'], ['Unggah Bukti', '/laporan']]
  const informasi = ['Tentang SIPEDULI', 'Kebijakan Privasi', 'Syarat Layanan', 'Aksesibilitas']
  return (
    <footer className="bg-ink text-white keep-ink">
      <div className="max-w-[1240px] mx-auto px-6 pt-20 pb-10 grid md:grid-cols-12 gap-10">
        <div className="md:col-span-4">
          <div className="flex items-center gap-3"><LogoBox light /><span className="font-bold tracking-[0.08em] text-[15px]">SIPEDULI</span></div>
          <p className="mt-5 text-white/70 text-[14px] leading-[1.6] max-w-[320px]">
            Sistem Pelaporan Kejahatan Terpadu — kanal resmi pelaporan warga yang terhubung langsung dengan kepolisian.
          </p>
          <p className="mt-4 mono text-[11px] uppercase tracking-[0.16em] text-white/40 max-w-[320px] leading-[1.6]">
            Disclaimer: SIPEDULI bukan pengganti panggilan darurat. Untuk situasi mengancam nyawa, hubungi 110.
          </p>
        </div>
        <div className="md:col-span-2">
          <div className="mono text-[11px] uppercase tracking-[0.18em] text-white/50">LAYANAN</div>
          <ul className="mt-4 space-y-3">
            {layanan.map(([l, href]) => (
              <li key={l}><Link href={href} className="text-[14px] hover:text-alert">{l}</Link></li>
            ))}
          </ul>
        </div>
        <div className="md:col-span-2">
          <div className="mono text-[11px] uppercase tracking-[0.18em] text-white/50">INFORMASI</div>
          <ul className="mt-4 space-y-3">
            {informasi.map(l => <li key={l}><a href="#" className="text-[14px] hover:text-alert">{l}</a></li>)}
          </ul>
        </div>
        <div className="md:col-span-4">
          <div className="mono text-[11px] uppercase tracking-[0.18em] text-white/50">DARURAT? HUBUNGI</div>
          <div className="mt-3 font-bold text-alert text-[88px] leading-none tracking-[-0.04em] numPulse">110</div>
          <div className="mt-3 text-white/70 text-[13px] leading-[1.6] max-w-[300px]">
            Layanan panggilan darurat kepolisian, 24 jam tanpa biaya, di seluruh Indonesia.
          </div>
          <div className="mt-5 flex items-center gap-3">
            <span className="mono text-[11px] uppercase tracking-[0.16em] text-white/50">SMS Pengaduan</span>
            <span className="mono font-bold text-[14px]">1717</span>
          </div>
        </div>
      </div>
      <div className="border-t border-white/15">
        <div className="max-w-[1240px] mx-auto px-6 py-6 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="mono text-[11px] uppercase tracking-[0.16em] text-white/50">
            © 2025 SIPEDULI · Sistem Pelaporan Kejahatan Terpadu · Republik Indonesia
          </div>
          <div className="flex items-center gap-6">
            <div className="mono text-[11px] uppercase tracking-[0.16em] text-white/50">VERSI 2.4.1 · STATUS: OPERASIONAL</div>
            {/* Link Portal Petugas — tidak mencolok */}
            <Link href="/admin/login" className="mono text-[11px] uppercase tracking-[0.16em] text-white/30 hover:text-white/60 transition-colors duration-200">
              Portal Petugas →
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

/* ============================================================
   PAGE — default export
   ============================================================ */
export default function Page() {
  const router = useRouter()
  const goToLaporan = () => router.push('/laporan')
  const goToTracker = () => smoothScrollTo('cek-status')
  return (
    <div className="bg-white">
      <Navbar   onCTA={goToLaporan} />
      <Hero     onReport={goToLaporan} onTrack={goToTracker} />
      <StatsBar />
      <HowItWorks />
      <UrgencySystem />
      <Tracker />
      <FAQ />
      <Footer />
    </div>
  )
}
