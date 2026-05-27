'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ThemeToggle } from '../../components/ThemeToggle'
import './dashboard.css'

/* ============================================================
   TYPES
   ============================================================ */
type Urg    = 'hi' | 'md' | 'lo'
type Status = 'recv' | 'anal' | 'inv' | 'done'
type LvlKey = 'red-dark' | 'red-light' | 'amber' | 'yellow' | 'gray'
type NavKey = 'dashboard' | 'laporan' | 'peta' | 'pengaturan'

interface Report {
  no: number
  id: string
  urg: Urg
  conf: number
  kron: string
  loc: string
  time: string
  status: Status
  keywords: string[]
  dist: { hi: number; md: number; lo: number }
}

interface DbLaporan {
  id: string
  ticket_id: string
  judul: string | null
  deskripsi: string
  lokasi: string | null
  nama_pelapor: string | null
  is_anonim: boolean
  prediksi_urgensi: string | null
  confidence_score: number | null
  keywords_detected: string[] | null
  status: string
  created_at: string
}

interface Stats {
  total: number
  tinggi: number
  aktif: number
  selesaiHariIni: number
}

interface Province {
  id: string
  nm: string
  lvl: LvlKey
  total: number
  hi: number
  md: number
  lo: number
  points: string
  label: { x: number; y: number }
}

interface MapContext { id: string; points: string }
interface MapDot    { cx: number; cy: number; r: number }
interface Notif     { id: string; urg: Urg; title: string; msg: string; time: string }
interface FotoBukti { id: string; filename: string; storage_url: string; file_size: number; mime_type: string }

/* ============================================================
   HELPERS
   ============================================================ */
function mapUrg(pred: string | null): Urg {
  if (pred === 'Tinggi') return 'hi'
  if (pred === 'Sedang') return 'md'
  return 'lo'
}

function mapStatus(s: string | null): Status {
  if (s === 'Dianalisis') return 'anal'
  if (s === 'Dalam Penyelidikan') return 'inv'
  if (s === 'Selesai' || s === 'Ditolak') return 'done'
  return 'recv'
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const months = ['JAN','FEB','MAR','APR','MEI','JUN','JUL','AGT','SEP','OKT','NOV','DES']
  return (
    String(d.getDate()).padStart(2, '0') + ' ' +
    months[d.getMonth()] + ' · ' +
    String(d.getHours()).padStart(2, '0') + ':' +
    String(d.getMinutes()).padStart(2, '0')
  )
}

function calcDist(urg: Urg, conf: number): { hi: number; md: number; lo: number } {
  const r = Math.max(0, Math.min(100, Math.round(conf)))
  const rem = 100 - r
  if (urg === 'hi') {
    const md = Math.round(rem * 0.7)
    return { hi: r, md, lo: rem - md }
  }
  if (urg === 'md') {
    const hi = Math.round(rem * 0.2)
    return { hi, md: r, lo: rem - hi }
  }
  const hi = Math.round(rem * 0.1)
  const md = Math.round(rem * 0.3)
  return { hi, md, lo: 100 - hi - md }
}

function dbToReport(row: DbLaporan, idx: number): Report {
  const urg  = mapUrg(row.prediksi_urgensi)
  const conf = Math.round(row.confidence_score ?? 0)
  return {
    no:       idx + 1,
    id:       row.ticket_id,
    urg,
    conf,
    kron:     row.deskripsi || row.judul || '-',
    loc:      row.lokasi || '-',
    time:     formatTime(row.created_at),
    status:   mapStatus(row.status),
    keywords: row.keywords_detected || [],
    dist:     calcDist(urg, conf),
  }
}

/* ============================================================
   STATIC DATA (map only)
   ============================================================ */
const LVL_COLOR: Record<LvlKey, string> = {
  'red-dark':  '#cc0000',
  'red-light': '#ff6b6b',
  'amber':     '#ffc107',
  'yellow':    '#fff3cd',
  'gray':      '#d1d5db',
}

const LVL_TEXT_LIGHT: Partial<Record<LvlKey, boolean>> = {
  'red-dark':  true,
  'red-light': true,
}

const MAP_CONTEXT: MapContext[] = [
  { id: 'sumatra-bg',    points: '60,30 110,55 145,85 175,125 200,165 220,200 245,232 250,260 230,265 210,250 188,222 170,190 145,150 118,118 90,90 65,65' },
  { id: 'kalimantan-bg', points: '290,58 360,52 430,55 510,68 530,118 525,160 495,200 440,210 380,205 320,185 290,140 278,98' },
  { id: 'sulawesi-bg',   points: '562,75 600,70 620,100 615,140 638,170 642,210 620,248 600,250 590,222 600,200 580,180 568,150 580,130 575,108 558,98' },
  { id: 'maluku-bg-1',   points: '740,148 770,152 768,182 742,180' },
  { id: 'maluku-bg-2',   points: '748,205 778,210 776,234 752,232' },
  { id: 'maluku-bg-3',   points: '720,178 738,180 736,200 722,198' },
  { id: 'papua-bg',      points: '800,95 855,80 910,82 965,100 985,150 980,210 955,258 905,285 850,290 815,272 800,228 793,170' },
  { id: 'java-bg',       points: '285,278 320,275 360,275 400,275 460,275 510,275 560,278 610,282 612,310 580,316 530,316 480,318 470,322 440,318 400,313 360,313 320,313 290,312' },
  { id: 'ntt-bg',        points: '625,308 660,308 680,310 705,310 735,312 760,316 752,330 720,332 685,332 660,328 630,323' },
]

const MAP_DOTS: MapDot[] = [
  { cx: 145, cy: 295, r: 4 },
  { cx: 270, cy: 220, r: 3 },
  { cx: 565, cy: 290, r: 3 },
  { cx: 770, cy: 90,  r: 5 },
  { cx: 245, cy: 30,  r: 4 },
  { cx: 695, cy: 268, r: 3 },
]

const PROVINCES: Province[] = [
  { id: 'sumut',  nm: 'Sumatera Utara',    lvl: 'amber',     total: 64,  hi: 14, md: 32, lo: 18, points: '60,30 110,55 118,82 90,98 65,82 52,55',                                                                    label: { x: 87,  y: 68  } },
  { id: 'lampung',nm: 'Lampung',           lvl: 'yellow',    total: 28,  hi: 4,  md: 14, lo: 10, points: '200,205 232,222 248,250 230,268 205,255 192,228',                                                           label: { x: 220, y: 245 } },
  { id: 'kalbar', nm: 'Kalimantan Barat',  lvl: 'gray',      total: 12,  hi: 1,  md: 5,  lo: 6,  points: '290,60 385,55 398,135 358,182 300,170 282,110',                                                             label: { x: 342, y: 115 } },
  { id: 'kaltim', nm: 'Kalimantan Timur',  lvl: 'gray',      total: 14,  hi: 2,  md: 7,  lo: 5,  points: '402,53 510,70 522,150 478,200 415,185 396,128',                                                             label: { x: 458, y: 130 } },
  { id: 'banten', nm: 'Banten',            lvl: 'amber',     total: 58,  hi: 12, md: 30, lo: 16, points: '290,280 327,277 330,308 295,312',                                                                           label: { x: 310, y: 297 } },
  { id: 'dki',    nm: 'DKI Jakarta',       lvl: 'red-dark',  total: 142, hi: 48, md: 64, lo: 30, points: '330,277 365,277 368,305 333,308',                                                                           label: { x: 349, y: 295 } },
  { id: 'jabar',  nm: 'Jawa Barat',        lvl: 'red-dark',  total: 168, hi: 52, md: 78, lo: 38, points: '368,275 444,277 446,308 370,310',                                                                           label: { x: 408, y: 295 } },
  { id: 'jateng', nm: 'Jawa Tengah',       lvl: 'red-light', total: 96,  hi: 24, md: 48, lo: 24, points: '446,275 508,277 510,308 448,310',                                                                           label: { x: 478, y: 295 } },
  { id: 'diy',    nm: 'D.I. Yogyakarta',   lvl: 'yellow',    total: 22,  hi: 3,  md: 9,  lo: 10, points: '470,310 506,310 508,326 472,326',                                                                           label: { x: 488, y: 320 } },
  { id: 'jatim',  nm: 'Jawa Timur',        lvl: 'red-light', total: 112, hi: 30, md: 56, lo: 26, points: '510,275 608,280 612,308 514,310',                                                                           label: { x: 562, y: 295 } },
  { id: 'bali',   nm: 'Bali',              lvl: 'yellow',    total: 24,  hi: 4,  md: 12, lo: 8,  points: '625,308 660,308 662,326 626,326',                                                                           label: { x: 644, y: 320 } },
  { id: 'ntt',    nm: 'NTT',               lvl: 'gray',      total: 8,   hi: 1,  md: 3,  lo: 4,  points: '675,310 738,313 752,330 700,332 680,322',                                                                   label: { x: 712, y: 322 } },
  { id: 'sulsel', nm: 'Sulawesi Selatan',  lvl: 'amber',     total: 52,  hi: 11, md: 28, lo: 13, points: '578,180 618,202 635,242 605,255 582,242 572,212',                                                           label: { x: 600, y: 225 } },
  { id: 'maluku', nm: 'Maluku',            lvl: 'gray',      total: 6,   hi: 0,  md: 2,  lo: 4,  points: '748,205 778,210 776,234 752,232',                                                                           label: { x: 762, y: 222 } },
  { id: 'papua',  nm: 'Papua',             lvl: 'gray',      total: 10,  hi: 1,  md: 4,  lo: 5,  points: '802,98 858,84 912,86 962,105 980,155 970,212 942,256 890,280 838,275 810,250 800,200 795,150',              label: { x: 880, y: 180 } },
]

/* ============================================================
   PROVINCE MATCHING — maps lokasi free-text → province id
   ============================================================ */
const PROVINCE_KEYWORDS: Record<string, string[]> = {
  dki:     ['jakarta', 'dki'],
  jatim:   ['surabaya', 'malang', 'jawa timur', 'jatim', 'sidoarjo', 'gresik', 'mojokerto', 'kediri', 'banyuwangi', 'jember', 'pasuruan', 'blitar', 'madiun', 'probolinggo'],
  jabar:   ['bandung', 'jawa barat', 'jabar', 'bogor', 'bekasi', 'depok', 'cimahi', 'cirebon', 'karawang', 'tasikmalaya', 'sukabumi', 'cianjur'],
  jateng:  ['semarang', 'jawa tengah', 'jateng', 'solo', 'surakarta', 'magelang', 'tegal', 'pekalongan', 'kudus', 'purwokerto', 'cilacap'],
  diy:     ['yogyakarta', 'jogja', 'diy', 'sleman', 'bantul', 'gunung kidul', 'kulon progo'],
  bali:    ['bali', 'denpasar', 'badung', 'gianyar', 'tabanan', 'buleleng'],
  banten:  ['banten', 'tangerang', 'serang', 'cilegon'],
  sumut:   ['medan', 'sumatera utara', 'sumut', 'binjai', 'pematang siantar'],
  lampung: ['lampung', 'bandar lampung', 'metro'],
  kalbar:  ['kalimantan barat', 'kalbar', 'pontianak', 'singkawang'],
  kaltim:  ['kalimantan timur', 'kaltim', 'samarinda', 'balikpapan', 'bontang'],
  sulsel:  ['sulawesi selatan', 'sulsel', 'makassar', 'parepare', 'palopo'],
  maluku:  ['maluku', 'ambon', 'ternate'],
  papua:   ['papua', 'jayapura', 'timika', 'manokwari', 'sorong'],
  ntt:     ['ntt', 'kupang', 'nusa tenggara timur', 'ende', 'flores', 'labuan bajo'],
}

function matchProvinceId(lokasi: string): string | null {
  const loc = lokasi.toLowerCase()
  for (const [id, kws] of Object.entries(PROVINCE_KEYWORDS)) {
    if (kws.some(kw => loc.includes(kw))) return id
  }
  return null
}

function computeProvinces(reports: Report[]): Province[] {
  const counts: Record<string, { hi: number; md: number; lo: number }> = {}
  reports.forEach(r => {
    const pid = matchProvinceId(r.loc)
    if (!pid) return
    if (!counts[pid]) counts[pid] = { hi: 0, md: 0, lo: 0 }
    counts[pid][r.urg]++
  })
  return PROVINCES.map(p => {
    const c = counts[p.id] ?? { hi: 0, md: 0, lo: 0 }
    const total = c.hi + c.md + c.lo
    const lvl: LvlKey =
      c.hi >= 5 ? 'red-dark'  :
      c.hi >= 2 ? 'red-light' :
      c.hi >= 1 ? 'amber'     :
      total >= 1 ? 'yellow'   : 'gray'
    return { ...p, total, hi: c.hi, md: c.md, lo: c.lo, lvl }
  })
}

/* ============================================================
   ATOMS
   ============================================================ */
function Badge({ urg }: { urg: Urg }) {
  const map: Record<Urg, [string, string]> = { hi: ['hi', 'TINGGI'], md: ['md', 'SEDANG'], lo: ['lo', 'RENDAH'] }
  const [cls, txt] = map[urg]
  return <span className={`badge ${cls}`}>{txt}</span>
}

function StatusPill({ s }: { s: Status }) {
  const map: Record<Status, [string, string]> = {
    recv: ['recv', 'Diterima'],
    anal: ['anal', 'Dianalisis'],
    inv:  ['inv',  'Penyelidikan'],
    done: ['done', 'Selesai'],
  }
  const [cls, txt] = map[s] ?? ['recv', 'Diterima']
  return <span className={`pill ${cls}`}>{txt}</span>
}

function HighlightedText({ text, keywords = [] }: { text: string; keywords?: string[] }) {
  if (!keywords.length) return <>{text}</>
  const re = new RegExp('(' + keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi')
  const parts = text.split(re)
  return (
    <>
      {parts.map((p, i) =>
        keywords.some(k => k.toLowerCase() === p.toLowerCase())
          ? <span key={i} className="hl">{p}</span>
          : <span key={i}>{p}</span>
      )}
    </>
  )
}

function confColor(urg: Urg) {
  return urg === 'hi' ? 'var(--alert)' : urg === 'md' ? 'var(--amber)' : 'var(--green)'
}

function useCountUp(target: number, { duration = 1200, delay = 0, decimals = 0 }: { duration?: number; delay?: number; decimals?: number } = {}) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    let raf: number, start: number | undefined
    const ease = (t: number) => 1 - Math.pow(1 - t, 3)
    const startTimer = setTimeout(() => {
      const tick = (now: number) => {
        if (!start) start = now
        const t = Math.min(1, (now - start) / duration)
        setVal(target * ease(t))
        if (t < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }, delay)
    return () => { clearTimeout(startTimer); if (raf) cancelAnimationFrame(raf) }
  }, [target, duration, delay])
  return decimals ? val.toFixed(decimals) : Math.round(val)
}

/* ============================================================
   SVG ICONS
   ============================================================ */
const SvgChart  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/></svg>
const SvgList   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1.2" fill="currentColor"/><circle cx="3.5" cy="12" r="1.2" fill="currentColor"/><circle cx="3.5" cy="18" r="1.2" fill="currentColor"/></svg>
const SvgMap    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14"/></svg>
const SvgGear   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>
const SvgBell   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>
const SvgSearch = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>

/* ============================================================
   SIDEBAR
   ============================================================ */
function Sidebar({ active, onChange, totalCount }: { active: NavKey; onChange: (k: NavKey) => void; totalCount: number }) {
  const links: { k: NavKey; ic: React.ReactNode; lbl: string; count?: string }[] = [
    { k: 'dashboard',   ic: <SvgChart />,  lbl: 'Dashboard' },
    { k: 'laporan',     ic: <SvgList />,   lbl: 'Semua Laporan', count: totalCount > 0 ? String(totalCount) : undefined },
    { k: 'peta',        ic: <SvgMap />,    lbl: 'Peta Kejahatan' },
    { k: 'pengaturan',  ic: <SvgGear />,   lbl: 'Pengaturan' },
  ]
  return (
    <aside className="sidebar">
      <div className="sb-top">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Logo SIPEDULI" className="sb-logo" />
        <span className="sb-brand">
          <span className="nm">SIPEDULI</span>
          <span className="sub">ADMIN PANEL</span>
        </span>
      </div>
      <div className="sb-divider" />
      <div className="sb-section-label">MENU UTAMA</div>
      <nav className="sb-nav">
        {links.map(l => (
          <button key={l.k} type="button" className={`sb-link ${active === l.k ? 'active' : ''}`} onClick={() => onChange(l.k)}>
            <span className="ic">{l.ic}</span>
            <span>{l.lbl}</span>
            {l.count && <span className="count">{l.count}</span>}
          </button>
        ))}
      </nav>
      <div className="sb-bottom">
        <div className="sb-divider" style={{ marginBottom: 14 }} />
        <div className="sb-status">
          <span className="live-dot" />
          <span className="stat-txt">SISTEM <b>AKTIF</b></span>
        </div>
        <div className="sb-version">VERSI 2.1 · MEI 2026</div>
      </div>
    </aside>
  )
}

/* ============================================================
   TOPBAR
   ============================================================ */
function TopBar({ active, onLogout, notifications, onMarkRead }: { active: NavKey; onLogout: () => void; notifications: Notif[]; onMarkRead: () => void }) {
  const [notifOpen, setNotifOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setNotifOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const titleMap: Record<NavKey, [string, string]> = {
    dashboard:  ['Dashboard',       'Ringkasan operasional & analisis'],
    laporan:    ['Semua Laporan',   'Manajemen berkas laporan'],
    peta:       ['Peta Kejahatan',  'Sebaran kasus per wilayah'],
    pengaturan: ['Pengaturan',      'Konfigurasi sistem'],
  }
  const [t] = titleMap[active] ?? titleMap.dashboard

  return (
    <div className="topbar">
      <div className="tb-left">
        <div className="tb-crumb">SIPEDULI · <b>{t.toUpperCase()}</b></div>
        <span className="tb-divider" />
        <div className="greeting">
          <div className="t">{t}</div>
          <div className="d">KAMIS, 14 MEI 2026 · 08:42 WIB</div>
        </div>
      </div>
      <div className="tb-right" ref={ref}>
        <button className={`bell ${notifOpen ? 'active' : ''}`} onClick={() => setNotifOpen(o => !o)} aria-label="Notifikasi">
          <SvgBell />
          {notifications.length > 0 && <span className="badge">{notifications.length}</span>}
        </button>
        {notifOpen && (
          <div className="notif-panel" role="dialog">
            <div className="notif-hd">
              <span className="t">Notifikasi</span>
              <button className="all" onClick={() => { onMarkRead(); setNotifOpen(false) }}>TANDAI SUDAH DIBACA</button>
            </div>
            {notifications.length === 0 && (
              <div style={{ padding: '16px 18px', color: 'var(--g500)', fontSize: 13 }}>Tidak ada notifikasi baru.</div>
            )}
            {notifications.map(n => (
              <div key={n.id} className="notif-item" onClick={() => setNotifOpen(false)}>
                <div className={`notif-bar ${n.urg}`} />
                <div className="body">
                  <div className="ttl">{n.title}</div>
                  <div className="msg">{n.msg}</div>
                  <div className="tm">{n.time}</div>
                </div>
              </div>
            ))}
            <div className="notif-foot">
              <a href="#" onClick={e => { e.preventDefault(); setNotifOpen(false) }}>LIHAT SEMUA NOTIFIKASI →</a>
            </div>
          </div>
        )}
        <span className="tb-divider" />
        <button className="avatar-row">
          <span className="avatar">AP</span>
          <span className="role">Petugas</span>
        </button>
        <span className="tb-divider" />
        <ThemeToggle />
        <span className="tb-divider" />
        <button
          onClick={onLogout}
          style={{
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: 11,
            letterSpacing: '0.16em',
            textTransform: 'uppercase' as const,
            fontWeight: 700,
            color: '#4b5563',
            border: '1px solid #e5e7eb',
            borderRadius: 4,
            padding: '0 12px',
            height: 32,
            cursor: 'pointer',
            background: '#fff',
            transition: 'border-color 0.2s ease, color 0.2s ease',
          }}
          onMouseEnter={e => {
            const b = e.currentTarget
            b.style.borderColor = '#0a0a0a'
            b.style.color = '#0a0a0a'
          }}
          onMouseLeave={e => {
            const b = e.currentTarget
            b.style.borderColor = '#e5e7eb'
            b.style.color = '#4b5563'
          }}
        >
          KELUAR
        </button>
      </div>
    </div>
  )
}

/* ============================================================
   KPI
   ============================================================ */
function KPI({ stats, isLoaded }: { stats: Stats; isLoaded: boolean }) {
  const total  = useCountUp(stats.total,           { duration: 1400, delay: 200 })
  const tinggi = useCountUp(stats.tinggi,          { duration: 1200, delay: 280 })
  const aktif  = useCountUp(stats.aktif,           { duration: 1300, delay: 360 })
  const done   = useCountUp(stats.selesaiHariIni,  { duration: 1100, delay: 440 })
  const dash   = <span style={{ opacity: 0.35 }}>—</span>
  return (
    <div className="kpi-grid">
      <div className="kpi">
        <div className="lbl">TOTAL LAPORAN</div>
        <div className="num">{isLoaded ? total : dash}</div>
        <div className="sub">SELURUH LAPORAN MASUK</div>
      </div>
      <div className="kpi alert">
        <div className="lbl">PRIORITAS TINGGI</div>
        <div className="num red">{isLoaded ? tinggi : dash}</div>
        <div className="sub">MEMBUTUHKAN TINDAKAN</div>
      </div>
      <div className="kpi ink">
        <div className="lbl">LAPORAN AKTIF</div>
        <div className="num">{isLoaded ? aktif : dash}</div>
        <div className="sub">SEDANG DIPROSES</div>
      </div>
      <div className="kpi green">
        <div className="lbl">TOTAL SELESAI</div>
        <div className="num green">{isLoaded ? done : dash}</div>
        <div className="sub">KASUS DITUTUP</div>
      </div>
    </div>
  )
}

/* ============================================================
   MAP
   ============================================================ */
function CrimeMap({ provinces }: { provinces: Province[] }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<{ p: Province; x: number; y: number } | null>(null)

  const onEnter = (p: Province, e: React.MouseEvent) => {
    if (!wrapRef.current) return
    const rect = wrapRef.current.getBoundingClientRect()
    setTip({ p, x: e.clientX - rect.left + 14, y: e.clientY - rect.top + 14 })
  }

  return (
    <div className="map-area" ref={wrapRef}>
      <svg viewBox="0 0 1000 380" className="map-svg" preserveAspectRatio="xMidYMid meet">
        <g>
          <line className="ocean-line" x1="0" y1="80"  x2="1000" y2="80"  />
          <line className="ocean-line" x1="0" y1="200" x2="1000" y2="200" />
          <line className="ocean-line" x1="0" y1="320" x2="1000" y2="320" />
          <line className="ocean-line" x1="200" y1="0" x2="200" y2="380"  />
          <line className="ocean-line" x1="500" y1="0" x2="500" y2="380"  />
          <line className="ocean-line" x1="800" y1="0" x2="800" y2="380"  />
        </g>
        {MAP_CONTEXT.map(c => <polygon key={c.id} className="prov-bg" points={c.points} />)}
        {MAP_DOTS.map((d, i)    => <circle key={i} className="dot" cx={d.cx} cy={d.cy} r={d.r} />)}
        {provinces.map(p => (
          <g key={p.id} onMouseEnter={e => onEnter(p, e)} onMouseMove={e => onEnter(p, e)} onMouseLeave={() => setTip(null)}>
            <polygon className="prov" points={p.points} fill={LVL_COLOR[p.lvl]} />
            <text x={p.label.x} y={p.label.y} textAnchor="middle" className={`prov-label ${LVL_TEXT_LIGHT[p.lvl] ? 'light' : ''}`}>
              {p.nm.toUpperCase()}
            </text>
          </g>
        ))}
        <g transform="translate(950, 30)">
          <circle cx="0" cy="0" r="14" fill="#fff" stroke="#d1d5db" strokeWidth="1" />
          <path d="M 0 -10 L 3 0 L 0 10 L -3 0 Z" fill="#0a0a0a" />
          <text x="0" y="-18" textAnchor="middle" className="compass">U</text>
        </g>
        <g transform="translate(40, 350)">
          <line className="scale-bar" x1="0" y1="0" x2="80" y2="0" />
          <line className="scale-bar" x1="0" y1="-3" x2="0"  y2="3"  />
          <line className="scale-bar" x1="80" y1="-3" x2="80" y2="3" />
          <text x="40" y="14" textAnchor="middle" className="scale-label">~ 1.000 KM</text>
        </g>
      </svg>
      {tip && (
        <div className="map-tooltip show" style={{ left: tip.x, top: tip.y }}>
          <div className="nm">{tip.p.nm}</div>
          <div className="total">{tip.p.total} TOTAL KASUS</div>
          <div className="bk">
            <span className="hi">● {tip.p.hi} Tinggi</span>
            <span className="md">● {tip.p.md} Sedang</span>
            <span className="lo">● {tip.p.lo} Rendah</span>
          </div>
        </div>
      )}
    </div>
  )
}

function MapPanel({ reports }: { reports: Report[] }) {
  const provinces = useMemo(() => computeProvinces(reports), [reports])
  const sorted = [...provinces].sort((a, b) => b.total - a.total)
  const top5   = sorted.slice(0, 5).filter(p => p.total > 0)
  const max    = top5[0]?.total || 1
  return (
    <div className="map-panel">
      <div className="map-card">
        <div className="hd">
          <div>
            <div className="t">PETA SEBARAN KEJAHATAN</div>
            <div className="s">PER PROVINSI · DATA REAL-TIME</div>
          </div>
          <div className="legend">
            {[['hi','Tinggi'],['lh','Cukup Tinggi'],['md','Sedang'],['ly','Rendah'],['lg','Minim Data']].map(([cls,lbl]) => (
              <span key={cls} className="item"><span className={`sw ${cls}`} />{lbl}</span>
            ))}
          </div>
        </div>
        <CrimeMap provinces={provinces} />
      </div>
      <div className="rank-card">
        <div className="hd">
          <div>
            <div className="t">PERINGKAT PROVINSI</div>
            <div className="s">5 TERATAS · TOTAL KASUS</div>
          </div>
        </div>
        <div className="rank-list">
          {top5.map((p, i) => (
            <div key={p.id} className="rk-row">
              <span className="ix">0{i + 1}</span>
              <div className="mid">
                <span className="nm">{p.nm}</span>
                <div className="bar-bg">
                  <div className={`bar-fl ${p.lvl === 'amber' ? 'md' : p.lvl === 'yellow' || p.lvl === 'gray' ? 'lo' : ''}`}
                       style={{ width: (p.total / max * 100) + '%' }} />
                </div>
                <div className="meta">{p.hi} TINGGI · {p.md} SEDANG · {p.lo} RENDAH</div>
              </div>
              <span className="vl">{p.total}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   FEED
   ============================================================ */
function FeedPanel({ onOpen, reports }: { onOpen: (r: Report) => void; reports: Report[] }) {
  const items = reports.slice(0, 6)
  return (
    <div className="card feed-card">
      <div className="card-hd">
        <div className="card-hd-l">
          <span className="live-dot red" />
          <div>
            <div className="t">LAPORAN TERBARU</div>
            <div className="s">UMPAN LANGSUNG</div>
          </div>
        </div>
        <button className="mono" style={{ fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--g500)', fontWeight: 700 }}>
          LIHAT SEMUA →
        </button>
      </div>
      <div className="feed">
        {items.length === 0 && (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--g500)', fontSize: 13 }}>
            Belum ada laporan masuk.
          </div>
        )}
        {items.map(r => (
          <div key={r.id} className="feed-row" onClick={() => onOpen(r)}>
            <div className="a">
              <span className="id">{r.id}</span>
              <Badge urg={r.urg} />
            </div>
            <div className="b">{r.kron}</div>
            <div className="c">
              <span>{r.loc}</span><span>·</span>
              <span>{r.time}</span><span>·</span>
              <span>{r.conf}% CONF.</span>
            </div>
            <div className="confbar"><i style={{ width: r.conf + '%', background: confColor(r.urg) }} /></div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ============================================================
   TABLE
   ============================================================ */
function ReportsTable({ onOpen, statuses, reports, total }: { onOpen: (r: Report) => void; statuses: Record<string, Status>; reports: Report[]; total: number }) {
  const [q,       setQ]       = useState('')
  const [urg,     setUrg]     = useState<Urg | 'all'>('all')
  const [urgOpen, setUrgOpen] = useState(false)

  const filtered = useMemo(() => {
    const ql = q.toLowerCase()
    return reports.filter(r =>
      (urg === 'all' || r.urg === urg) &&
      (!ql || r.id.toLowerCase().includes(ql) || r.kron.toLowerCase().includes(ql))
    )
  }, [q, urg, reports])

  const urgLabel: Record<Urg | 'all', string> = { all: 'SEMUA URGENSI', hi: 'TINGGI', md: 'SEDANG', lo: 'RENDAH' }

  return (
    <div className="card tbl-card">
      <div className="tbl-head">
        <div className="l">
          <span className="t">DAFTAR LAPORAN</span>
          <span className="s">{filtered.length} TERTAMPIL · {total} TOTAL</span>
        </div>
        <div className="r">
          <div className="search">
            <SvgSearch />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari laporan..." />
          </div>
          <div style={{ position: 'relative' }}>
            <button className="filter" onClick={() => setUrgOpen(o => !o)}>
              {urgLabel[urg]} <span>▾</span>
            </button>
            {urgOpen && (
              <div className="dd-menu">
                {(['all', 'hi', 'md', 'lo'] as const).map(v => (
                  <button key={v} onClick={() => { setUrg(v); setUrgOpen(false) }}>
                    {urgLabel[v]}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="ghost-pill">↓ EXPORT CSV</button>
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="dt">
          <thead>
            <tr>
              <th>NO</th><th>ID LAPORAN</th><th>KRONOLOGI</th><th>URGENSI</th>
              <th>CONFIDENCE</th><th>LOKASI</th><th>WAKTU</th><th>STATUS</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} onClick={() => onOpen(r)}>
                <td className="no">{String(r.no).padStart(2, '0')}</td>
                <td className="id">{r.id}</td>
                <td className="kron">
                  <span className="ktrunc">
                    <HighlightedText text={r.kron} keywords={r.keywords} />
                  </span>
                </td>
                <td><Badge urg={r.urg} /></td>
                <td className="conf">
                  <span className="v">{r.conf}%</span>
                  <div className="b"><i style={{ width: r.conf + '%', background: confColor(r.urg) }} /></div>
                </td>
                <td className="loc">{r.loc}</td>
                <td className="tm">{r.time}</td>
                <td><StatusPill s={statuses[r.id] ?? r.status} /></td>
                <td className="act"><button>DETAIL →</button></td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={9} style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--g500)' }}>
                {reports.length === 0 ? 'Memuat data...' : 'Tidak ada laporan yang cocok dengan filter.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="pagination">
        <span className="label">MENAMPILKAN {filtered.length} DARI {total} LAPORAN</span>
        <div className="ctrl">
          <button className="pg-btn" disabled>← PREV</button>
          <button className="pg-btn">NEXT →</button>
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   MODAL
   ============================================================ */
function Modal({ report, status, onUpdateStatus, onClose }: {
  report: Report
  status: Status
  onUpdateStatus: (id: string, st: Status) => void
  onClose: () => void
}) {
  const [ddOpen, setDdOpen] = useState(false)
  const [fotos, setFotos] = useState<FotoBukti[]>([])
  const [fotosLoading, setFotosLoading] = useState(true)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [onClose])

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    setFotosLoading(true)
    fetch(`${apiUrl}/api/laporan/${report.id}/foto`)
      .then(r => r.json())
      .then(d => setFotos(d.data ?? []))
      .catch(() => setFotos([]))
      .finally(() => setFotosLoading(false))
  }, [report.id])

  const order: Status[] = ['recv', 'anal', 'inv', 'done']
  const stIdx = order.indexOf(status)
  const tlSteps = [
    { k: 'recv' as Status, l: 'Diterima',     m: 'Tersimpan'     },
    { k: 'anal' as Status, l: 'Dianalisis',   m: 'Klasifikasi AI' },
    { k: 'inv'  as Status, l: 'Penyelidikan', m: 'Tindak lanjut' },
    { k: 'done' as Status, l: 'Selesai',      m: 'Berkas ditutup' },
  ]
  const fillW    = stIdx <= 0 ? '0%' : (stIdx / (tlSteps.length - 1) * 75) + '%'
  const confCls  = report.urg === 'hi' ? '' : report.urg === 'md' ? 'amber' : 'green'

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="m-hd">
          <div className="l">
            <span className="id">{report.id}</span>
            <Badge urg={report.urg} />
          </div>
          <button className="x-btn" onClick={onClose}>✕</button>
        </div>

        {/* Body: Identitas + ML */}
        <div className="m-body">
          <div>
            <div className="sec-lbl">IDENTITAS PELAPOR</div>
            <div className="id-grid">
              <div><div className="k">PELAPOR</div><div className="v">Anonim</div></div>
              <div><div className="k">LOKASI</div><div className="v">{report.loc}</div></div>
              <div><div className="k">WAKTU</div><div className="v">{report.time}</div></div>
              <div><div className="k">STATUS</div><div className="v" style={{ marginTop: 6 }}><StatusPill s={status} /></div></div>
            </div>
            <div className="sec-lbl" style={{ marginTop: 18 }}>KRONOLOGI LAPORAN</div>
            <div className="kron-box">
              <HighlightedText text={report.kron} keywords={report.keywords} />
            </div>
          </div>
          <div>
            <div className="sec-lbl">HASIL ANALISIS ML</div>
            <span className={`urg-big ${report.urg}`}>
              {report.urg === 'hi' ? 'TINGGI' : report.urg === 'md' ? 'SEDANG' : 'RENDAH'}
            </span>
            <div className="conf-bar-wrap">
              <div className={`conf-bar ${confCls}`}><i style={{ width: report.conf + '%' }} /></div>
              <div className="conf-lbl">{report.conf}% CONFIDENCE SCORE</div>
            </div>
            <div className="sec-lbl" style={{ marginTop: 18 }}>KEYWORDS TERDETEKSI</div>
            <div className="chips">
              {report.keywords.length > 0
                ? report.keywords.map(k => <span key={k} className="chip">{k}</span>)
                : <span style={{ color: 'var(--g500)', fontSize: 13 }}>Tidak ada keyword terdeteksi.</span>
              }
            </div>
            <div className="sec-lbl" style={{ marginTop: 18 }}>DISTRIBUSI PROBABILITAS</div>
            <div>
              {([['hi', 'Tinggi', 'var(--alert)'], ['md', 'Sedang', 'var(--amber)'], ['lo', 'Rendah', 'var(--green)']] as const).map(([cls, lbl, color]) => (
                <div key={cls} className="dist-row">
                  <span className="dlbl"><span className={`dot ${cls}`} />{lbl}</span>
                  <div className="bar"><i style={{ width: report.dist[cls] + '%', background: color }} /></div>
                  <span className="pct">{report.dist[cls]}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Foto Bukti */}
        <div className="photos">
          <div className="sec-lbl">FOTO BUKTI</div>
          {fotosLoading ? (
            <div style={{ color: 'var(--g500)', fontSize: 13, padding: '8px 0' }}>Memuat foto...</div>
          ) : fotos.length === 0 ? (
            <div style={{ color: 'var(--g500)', fontSize: 13, fontStyle: 'italic', padding: '8px 0' }}>
              Tidak ada foto bukti yang dilampirkan.
            </div>
          ) : (
            <div className="photo-grid">
              {fotos.map(f => (
                <a key={f.id} href={f.storage_url} target="_blank" rel="noopener noreferrer" className="photo" title={f.filename}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.storage_url} alt={f.filename} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="tl-wrap">
          <div className="sec-lbl">STATUS PENANGANAN</div>
          <div className="tl-grid">
            <div className="fill" style={{ width: fillW }} />
            {tlSteps.map((s, i) => {
              const cls = i < stIdx ? 'done' : i === stIdx ? 'curr' : ''
              return (
                <div key={s.k} className={`tl-step ${cls}`}>
                  <div className="node">{i < stIdx ? '✓' : i === stIdx ? '●' : ''}</div>
                  <div className="lbl">{s.l}</div>
                  <div className="meta">{s.m}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="tl-actions">
          <div className="l">PETUGAS: Polrestabes · Unit IV</div>
          <div className="r">
            <div style={{ position: 'relative' }}>
              <button className="btn-dark" onClick={() => setDdOpen(o => !o)}>UPDATE STATUS ▾</button>
              {ddOpen && (
                <div className="dd-menu">
                  {tlSteps.map(s => (
                    <button key={s.k} onClick={() => { onUpdateStatus(report.id, s.k); setDdOpen(false) }}>
                      {s.l}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="btn-ghost">+ TAMBAH CATATAN</button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   PLACEHOLDER
   ============================================================ */
function Placeholder({ title, meta, body }: { title: string; meta: string; body: string }) {
  return (
    <div className="placeholder">
      <div className="icbox"><SvgGear /></div>
      <div className="meta">{meta}</div>
      <h2>{title}</h2>
      <p>{body}</p>
    </div>
  )
}

/* ============================================================
   URGENCY ALERT
   ============================================================ */
function UrgencyAlert({ count, onDismiss, onAction }: {
  count: number
  onDismiss: () => void
  onAction: () => void
}) {
  return (
    <div className="urgency-alert" role="alertdialog" aria-label="Peringatan urgensi tinggi">
      <div className="ua-head">
        <div className="ua-label">
          <span className="live-dot red" />
          URGENSI TINGGI
        </div>
        <button className="ua-dismiss" onClick={onDismiss} aria-label="Tutup peringatan">✕</button>
      </div>
      <div className="ua-body">
        <div className="ua-num">{count}</div>
        <div className="ua-text">
          <div className="t">Kasus membutuhkan<br />penanganan segera</div>
          <div className="s">BELUM DITINDAK</div>
        </div>
      </div>
      <button className="ua-btn" onClick={onAction}>
        TANGANI SEKARANG →
      </button>
    </div>
  )
}

/* ============================================================
   PAGE — default export
   ============================================================ */
export default function DashboardPage() {
  const router = useRouter()
  const [active,     setActive]     = useState<NavKey>('dashboard')
  const [selected,   setSelected]   = useState<Report | null>(null)
  const [statuses,   setStatuses]   = useState<Record<string, Status>>({})
  const [reports,    setReports]    = useState<Report[]>([])
  const [stats,      setStats]      = useState<Stats>({ total: 0, tinggi: 0, aktif: 0, selesaiHariIni: 0 })
  const [newReports,    setNewReports]    = useState<Report[]>([])
  const [isLoaded,      setIsLoaded]      = useState(false)
  const [alertVisible,  setAlertVisible]  = useState(false)
  const seenIdsRef      = useRef<Set<string>>(new Set())
  const isFirstFetch    = useRef(true)
  const alertShownOnce  = useRef(false)

  useEffect(() => {
    const session = localStorage.getItem('sipeduli_admin')
    if (!session) router.push('/admin/login')
  }, [router])

  const fetchData = useCallback(async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const res = await fetch(`${apiUrl}/api/laporan`)
      if (!res.ok) throw new Error('Gagal mengambil data laporan')
      const json = await res.json()
      const fetched = (json.data as DbLaporan[]).map((row, i) => dbToReport(row, i))
      setReports(fetched)
      setStats(json.stats as Stats)

      setIsLoaded(true)
      if (isFirstFetch.current) {
        // Tandai semua laporan yang sudah ada sebagai "sudah dilihat"
        fetched.forEach(r => seenIdsRef.current.add(r.id))
        isFirstFetch.current = false
      } else {
        // Deteksi laporan yang benar-benar baru masuk sejak fetch terakhir
        const fresh = fetched.filter(r => !seenIdsRef.current.has(r.id))
        if (fresh.length > 0) {
          fresh.forEach(r => seenIdsRef.current.add(r.id))
          setNewReports(prev => [...fresh, ...prev].slice(0, 10))
        }
      }
    } catch (err) {
      console.error('fetchData error:', err)
    }
  }, [])

  // Polling otomatis setiap 10 detik
  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, 10_000)
    return () => clearInterval(id)
  }, [fetchData])

  const notifications: Notif[] = useMemo(() =>
    newReports.map(r => ({
      id:    `n-${r.id}`,
      urg:   r.urg,
      title: r.urg === 'hi' ? 'Laporan PRIORITAS TINGGI masuk!' : 'Laporan baru masuk',
      msg:   `${r.id} · ${r.kron.slice(0, 55)}${r.kron.length > 55 ? '...' : ''}`,
      time:  r.time,
    }))
  , [newReports])

  const markAllRead = useCallback(() => {
    setNewReports([])
  }, [])

  // Tampilkan alert saat pertama load jika ada Tinggi, atau saat laporan Tinggi baru masuk
  useEffect(() => {
    if (isLoaded && !alertShownOnce.current && reports.some(r => r.urg === 'hi')) {
      setAlertVisible(true)
      alertShownOnce.current = true
    }
  }, [isLoaded, reports])

  useEffect(() => {
    if (newReports.some(r => r.urg === 'hi')) {
      setAlertVisible(true)
    }
  }, [newReports])

  const totalSelesai = useMemo(() =>
    reports.filter(r => (statuses[r.id] ?? r.status) === 'done').length
  , [reports, statuses])

  const handleLogout = () => {
    localStorage.removeItem('sipeduli_admin')
    router.push('/admin/login')
  }

  const updateStatus = (id: string, st: Status) => {
    // Optimistic update
    setStatuses(s => ({ ...s, [id]: st }))
    const statusMap: Record<Status, string> = {
      recv: 'Diterima',
      anal: 'Dianalisis',
      inv:  'Dalam Penyelidikan',
      done: 'Selesai',
    }
    void (async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
        const res = await fetch(`${apiUrl}/api/laporan/${id}/status`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ status: statusMap[st] }),
        })
        if (!res.ok) {
          // Revert optimistic update on failure
          setStatuses(s => { const n = { ...s }; delete n[id]; return n })
          const err = await res.json().catch(() => ({ detail: 'Gagal update status' }))
          alert(`Gagal update status: ${err.detail ?? res.statusText}`)
          return
        }
        // Re-fetch so KPI counts (aktif, selesai hari ini) stay accurate
        await fetchData()
      } catch (err) {
        setStatuses(s => { const n = { ...s }; delete n[id]; return n })
        console.error('updateStatus error:', err)
      }
    })()
  }

  const currentStatus = selected ? (statuses[selected.id] ?? selected.status) : null

  return (
    <div className="app">
      <Sidebar active={active} onChange={setActive} totalCount={stats.total} />
      <div className="main">
        <TopBar active={active} onLogout={handleLogout} notifications={notifications} onMarkRead={markAllRead} />
        {active === 'dashboard' && (
          <>
            <KPI stats={{ ...stats, selesaiHariIni: totalSelesai }} isLoaded={isLoaded} />
            <MapPanel reports={reports} />
            <div className="tbl-feed-grid">
              <ReportsTable onOpen={setSelected} statuses={statuses} reports={reports} total={stats.total} />
              <FeedPanel onOpen={setSelected} reports={reports} />
            </div>
          </>
        )}
        {active === 'laporan' && (
          <div className="tbl-feed-grid" style={{ gridTemplateColumns: '1fr', paddingTop: 24 }}>
            <ReportsTable onOpen={setSelected} statuses={statuses} reports={reports} total={stats.total} />
          </div>
        )}
        {active === 'peta' && (
          <div style={{ padding: '14px 24px 24px' }}>
            <MapPanel reports={reports} />
          </div>
        )}
        {active === 'pengaturan' && (
          <Placeholder
            title="Pengaturan Sistem"
            meta="HALAMAN DALAM PENGEMBANGAN"
            body="Konfigurasi pengguna, peran, ambang batas model, dan integrasi unit kepolisian akan tersedia di rilis berikutnya."
          />
        )}
      </div>
      {selected && currentStatus && (
        <Modal
          report={selected}
          status={currentStatus}
          onUpdateStatus={updateStatus}
          onClose={() => setSelected(null)}
        />
      )}
      {alertVisible && (
        <UrgencyAlert
          count={reports.filter(r => r.urg === 'hi').length}
          onDismiss={() => setAlertVisible(false)}
          onAction={() => { setAlertVisible(false); setActive('laporan') }}
        />
      )}
    </div>
  )
}
