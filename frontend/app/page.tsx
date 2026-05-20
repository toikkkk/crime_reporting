'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ThemeToggle } from './components/ThemeToggle'

/* ============================================================
   TYPES
   ============================================================ */
interface RevealOptions { threshold?: number; rootMargin?: string }
interface CountUpOptions { duration?: number; decimals?: number; suffix?: string; prefix?: string }
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
function LogoBox({ size = 32, light = false }: { size?: number; light?: boolean }) {
  return (
    <div className="shrink-0 r4"
      style={{ width: size, height: size, border: `1px dashed ${light ? '#9ca3af' : '#0a0a0a'}`, display: 'inline-block' }}
      aria-label="Logo SIPEDULI" />
  )
}

function Badge({ kind = 'tinggi', children }: { kind?: BadgeKind; children: React.ReactNode }) {
  const s: Record<BadgeKind, string> = { tinggi: 'bg-alert text-white', sedang: 'bg-ink text-white', rendah: 'bg-gray-200 text-ink' }
  return <span className={`mono text-[11px] font-bold tracking-[0.08em] uppercase px-2 py-1 r4 ${s[kind]}`}>{children}</span>
}

function RedLabel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`text-alert text-[12px] font-bold tracking-[0.18em] uppercase ${className}`}>{children}</div>
}

function MagneticButton({ children, onClick, variant = 'primary', className = '' }: { children: React.ReactNode; onClick?: () => void; variant?: 'primary' | 'ghost'; className?: string }) {
  const ref = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const onMove = (e: React.MouseEvent) => {
    if (!ref.current) return
    const r = ref.current.getBoundingClientRect()
    setPos({ x: (e.clientX - r.left - r.width / 2) * 0.18, y: (e.clientY - r.top - r.height / 2) * 0.22 })
  }
  const base    = 'r4 inline-flex items-center justify-center font-bold text-[14px] tracking-[0.04em] uppercase px-7 py-4 relative overflow-hidden'
  const varCls  = variant === 'primary' ? 'bg-ink text-white' : 'bg-white text-ink border border-ink'
  return (
    <button ref={ref} onClick={onClick} onMouseMove={onMove} onMouseLeave={() => setPos({ x: 0, y: 0 })}
      className={`${base} ${varCls} magBtn ${className}`}
      style={{ transform: `translate(${pos.x}px,${pos.y}px)`, transition: 'transform .45s cubic-bezier(.2,.7,.2,1),background-color .2s ease' }}>
      <span className="sweep" aria-hidden="true" />
      <span style={{ position: 'relative', zIndex: 1 }}>{children}</span>
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
            className="r4 hidden sm:inline-flex items-center justify-center bg-ink text-white font-bold text-[14px] tracking-[0.04em] uppercase px-5 py-3 hover:bg-black btnPress">
            Laporkan Sekarang
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
    <section id="beranda" className="bg-white relative overflow-hidden">
      <div className="hero-grid absolute inset-0 pointer-events-none" aria-hidden="true">
        <span className="grid-sq"    style={{ top: '18%', left: '14%' }} />
        <span className="grid-sq alert" style={{ top: '32%', left: '22%' }} />
        <span className="grid-sq"    style={{ top: '60%', left: '8%' }} />
        <span className="grid-sq alert" style={{ top: '22%', right: '16%' }} />
        <span className="grid-sq"    style={{ top: '48%', right: '10%' }} />
        <span className="grid-sq"    style={{ bottom: '18%', right: '22%' }} />
        <span className="grid-sq"    style={{ bottom: '28%', left: '30%' }} />
      </div>
      <span className="float-mark"   style={{ top: '14%', left: '8%' }} aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#cc0000" strokeWidth="2"><path d="M2 11h18M11 2v18"/></svg>
      </span>
      <span className="float-mark b" style={{ top: '22%', right: '10%' }} aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="14" height="14"/></svg>
      </span>
      <span className="float-mark c" style={{ bottom: '18%', left: '12%' }} aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#cc0000" strokeWidth="2"><circle cx="7" cy="7" r="5"/></svg>
      </span>
      <span className="float-mark"   style={{ bottom: '24%', right: '8%' }} aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 10l4-4 4 4 4-4 4 4"/></svg>
      </span>

      <div className="max-w-[900px] mx-auto px-6 pt-20 md:pt-32 pb-20 md:pb-28 text-center relative z-10">
        <div className="heroAnim flex flex-col items-center">
          <RedLabel className="mb-8"><span className="redLabel">SISTEM PELAPORAN KEJAHATAN TERPADU</span></RedLabel>
          <h1 className="heroTitle font-bold leading-[0.95] tracking-[-0.02em] text-[64px] md:text-[104px]">
            <span className="word delay-1">Laporkan.</span><br />
            <span className="word delay-2 text-alert">Kami&nbsp;Tindak.</span>
          </h1>
          <p className="mt-8 text-gray-600 text-[17px] md:text-[18px] leading-[1.55] max-w-[620px] mx-auto">
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
          <div className="mt-16 grid grid-cols-3 gap-0 border-y border-gray-200 w-full max-w-[680px]">
            {[['ISO 27001','Keamanan data'],['UU PDP','Patuh regulasi'],['24/7','Operasional']].map(([k,v]) => (
              <div key={k} className="trustCell py-5 px-2 border-r last:border-r-0 border-gray-200">
                <div className="font-bold text-[14px] tracking-[0.08em]">{k}</div>
                <div className="mono text-[10px] uppercase tracking-[0.14em] text-gray-500 mt-1">{v}</div>
              </div>
            ))}
          </div>
          <div className="mt-12 inline-flex items-center gap-4 border border-gray-200 r4 px-6 py-3 emergency-chip">
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
const STATUS_DB: Record<string, StatusEntry> = {
  'CRM-2025-0089': { stage: 2, kind: 'tinggi', cat: 'Pencurian dengan kekerasan',   loc: 'Jakarta Pusat', updated: '12 menit lalu', officer: 'Polrestabes Jakpus · Unit IV'       },
  'CRM-2025-0088': { stage: 1, kind: 'sedang', cat: 'Pengrusakan fasilitas umum',   loc: 'Bandung',       updated: '38 menit lalu', officer: 'Polrestabes Bandung · Reskrim'      },
  'CRM-2025-0087': { stage: 3, kind: 'rendah', cat: 'Gangguan ketertiban',          loc: 'Surabaya',      updated: '1 jam lalu',    officer: 'Polsek Wonokromo'                   },
}

function Tracker() {
  const [q,      setQ]      = useState('CRM-2025-0089')
  const [active, setActive] = useState('CRM-2025-0089')
  const [error,  setError]  = useState('')
  const data = STATUS_DB[active]
  const steps = [
    { label: 'Diterima',     meta: 'Laporan tersimpan'    },
    { label: 'Dianalisis',   meta: 'Klasifikasi AI'       },
    { label: 'Penyelidikan', meta: 'Tindak lanjut polisi' },
    { label: 'Selesai',      meta: 'Berkas ditutup'       },
  ]
  const [hdrRef, hdrShown] = useReveal()
  const [tlRef,  tlShown]  = useReveal({ threshold: 0.25 })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const key = q.trim().toUpperCase()
    if (STATUS_DB[key]) { setActive(key); setError('') }
    else setError('Nomor laporan tidak ditemukan. Coba CRM-2025-0089.')
  }

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
            <input type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="Contoh: CRM-2025-0089"
              className="mono w-full bg-transparent text-[15px] font-bold tracking-[0.04em] outline-none" />
          </div>
          <button type="submit" className="bg-ink text-white font-bold text-[13px] tracking-[0.18em] uppercase px-7 py-4 hover:bg-black">
            Cek Status
          </button>
        </form>
        {error && <div className="mt-3 mono text-[12px] text-alert uppercase tracking-[0.12em]">{error}</div>}

        <div className="mt-10 border border-gray-200 r4 bg-white">
          <div className="grid md:grid-cols-4 border-b border-gray-200">
            {([
              ['NO. LAPORAN', <span key="id" className="mono font-bold">{active}</span>],
              ['JENIS',       data.cat],
              ['LOKASI',      data.loc],
              ['DIPERBARUI',  data.updated],
            ] as [string, React.ReactNode][]).map(([k, v], i) => (
              <div key={String(k)} className={`px-6 py-5 ${i < 3 ? 'md:border-r border-b md:border-b-0 border-gray-200' : ''}`}>
                <div className="mono text-[10px] uppercase tracking-[0.18em] text-gray-500">{k}</div>
                <div className="mt-2 font-bold text-[15px]">{v}</div>
              </div>
            ))}
          </div>

          <div ref={tlRef} className={`px-6 md:px-10 py-10 reveal up ${tlShown ? 'in' : ''}`}
            style={{ '--tl': `${data.stage / 3}` } as React.CSSProperties}>
            <div className="grid grid-cols-4 gap-3 relative">
              <div className="absolute left-0 right-0 top-[12px] h-px bg-gray-200"
                style={{ marginLeft: 'calc(12.5% + 14px)', marginRight: 'calc(12.5% + 14px)' }} />
              <div className="tlBar" style={{ left: 'calc(12.5% + 14px)', right: 'calc(12.5% + 14px)', width: 'auto' }} />
              {steps.map((s, i) => {
                const filled = i < data.stage, current = i === data.stage
                let bg = '#ffffff', border = '#9ca3af', mark = ''
                if (filled)  { bg = '#0a0a0a'; border = '#0a0a0a'; mark = '✓' }
                if (current) { bg = '#cc0000'; border = '#cc0000'; mark = '●' }
                return (
                  <div key={s.label} className="flex flex-col items-center text-center px-2 relative z-10">
                    <div className={`w-[28px] h-[28px] r4 flex items-center justify-center text-white text-[12px] font-bold transition-all duration-500 ${current ? 'ringPulse' : ''}`}
                      style={{ background: bg, border: `2px solid ${border}` }}>
                      <span style={{ color: filled || current ? '#ffffff' : 'transparent' }}>{mark}</span>
                    </div>
                    <div className="mt-3 font-bold text-[14px]" style={{ color: filled || current ? '#0a0a0a' : '#9ca3af' }}>{s.label}</div>
                    <div className="mt-1 mono text-[10px] uppercase tracking-[0.14em] text-gray-500">{s.meta}</div>
                  </div>
                )
              })}
            </div>
            <div className="mt-10 grid md:grid-cols-3 gap-0 border-t border-gray-200 pt-6">
              <div className="md:pr-6">
                <div className="mono text-[10px] uppercase tracking-[0.18em] text-gray-500">PETUGAS PENANGANAN</div>
                <div className="mt-2 font-bold text-[15px]">{data.officer}</div>
              </div>
              <div className="md:px-6 md:border-l border-gray-200 mt-6 md:mt-0">
                <div className="mono text-[10px] uppercase tracking-[0.18em] text-gray-500">PRIORITAS</div>
                <div className="mt-2">
                  <Badge kind={data.kind}>{data.kind === 'tinggi' ? 'TINGGI' : data.kind === 'sedang' ? 'SEDANG' : 'RENDAH'}</Badge>
                </div>
              </div>
              <div className="md:pl-6 md:border-l border-gray-200 mt-6 md:mt-0">
                <div className="mono text-[10px] uppercase tracking-[0.18em] text-gray-500">TINDAKAN ANDA</div>
                <div className="mt-2 font-bold text-[15px]">Tambahkan informasi atau bukti baru</div>
                {/* Sinkron ke /laporan */}
                <Link href="/laporan" className="mt-2 mono text-[11px] uppercase tracking-[0.18em] font-bold underline underline-offset-4">
                  LAPORAN BARU →
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="mono text-[11px] uppercase tracking-[0.18em] text-gray-500">CONTOH:</span>
          {Object.keys(STATUS_DB).map(id => (
            <button key={id} onClick={() => { setQ(id); setActive(id); setError('') }}
              className={`mono text-[12px] font-bold px-3 py-1 r4 border ${active === id ? 'bg-ink text-white border-ink' : 'border-gray-300 hover:border-ink'}`}>
              {id}
            </button>
          ))}
        </div>
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
  const goToLaporan = () => router.push('/laporan')  // SINKRON ke form input user
  const goToTracker = () => smoothScrollTo('cek-status')
  return (
    <div className="bg-white">
      <Navbar   onCTA={goToLaporan} />
      <Hero     onReport={goToLaporan} onTrack={goToTracker} />
      <HowItWorks />
      <UrgencySystem />
      <Tracker />
      <FAQ />
      <Footer />
    </div>
  )
}
