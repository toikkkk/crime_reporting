'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { ThemeToggle } from '../components/ThemeToggle'

/* ============================================================
   TYPES
   ============================================================ */
interface FormData {
  // Step 1 — Identitas
  mode: 'identitas' | 'anonim'
  nama: string
  noHp: string
  email: string

  // Step 2 — Detail Kejadian
  judul: string
  lokasi: string
  tanggal: string
  waktu: string
  deskripsi: string

  // Step 3 — Bukti
  files: File[]
}

interface UploadedFile {
  file: File
  preview: string
}

/* ============================================================
   CONSTANTS
   ============================================================ */
const STEPS = [
  { n: '01', label: 'Identitas'   },
  { n: '02', label: 'Kejadian'    },
  { n: '03', label: 'Bukti'       },
]


/* ============================================================
   ATOMS — shared with landing page aesthetic
   ============================================================ */
function LogoBox({ size = 28 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/logo.png" alt="Logo SIPEDULI"
      style={{ width: size, height: size, objectFit: 'contain', display: 'inline-block' }} />
  )
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block mono text-[11px] uppercase tracking-[0.18em] text-gray-500 mb-2">
      {children}
      {required && <span className="text-alert ml-1">*</span>}
    </label>
  )
}

function Input({
  value, onChange, placeholder, type = 'text', required, disabled,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string
  type?: string; required?: boolean; disabled?: boolean
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      className="w-full border border-gray-200 r4 px-4 py-3 text-[15px] font-medium outline-none
                 focus:border-ink transition-colors duration-200 disabled:bg-gray-50 disabled:text-gray-400
                 placeholder:text-gray-400"
    />
  )
}

function Textarea({
  value, onChange, placeholder, rows = 6, required,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string
  rows?: number; required?: boolean
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      required={required}
      className="w-full border border-gray-200 r4 px-4 py-3 text-[15px] font-medium outline-none
                 focus:border-ink transition-colors duration-200 resize-none leading-relaxed
                 placeholder:text-gray-400"
    />
  )
}

function ValidationMsg({ msg }: { msg: string }) {
  return msg ? (
    <p className="mt-2 mono text-[11px] text-alert uppercase tracking-[0.12em]">{msg}</p>
  ) : null
}

/* ============================================================
   STEP INDICATOR
   ============================================================ */
function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((s, i) => {
        const done    = i < current
        const active  = i === current
        return (
          <div key={s.n} className="flex items-center">
            <div className={`flex items-center gap-2 px-4 py-3 transition-all duration-300
              ${active  ? 'bg-ink text-white' : ''}
              ${done    ? 'bg-gray-100 text-gray-500' : ''}
              ${!active && !done ? 'text-gray-400' : ''}
            `}>
              <span className={`mono text-[11px] font-bold tracking-[0.08em]
                ${active ? 'text-alert' : ''}`}>
                {done ? '✓' : s.n}
              </span>
              <span className={`text-[13px] font-bold tracking-[0.04em] uppercase hidden sm:inline`}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-px w-6 md:w-10 transition-colors duration-500 ${i < current ? 'bg-ink' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
      <div className="ml-auto mono text-[11px] uppercase tracking-[0.16em] text-gray-400 hidden md:block">
        LANGKAH {current + 1} / {STEPS.length}
      </div>
    </div>
  )
}

/* ============================================================
   STEP 1 — IDENTITAS PELAPOR
   ============================================================ */
function Step1({
  data, setData, onNext,
}: {
  data: FormData
  setData: (d: Partial<FormData>) => void
  onNext: () => void
}) {
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const e: Record<string, string> = {}
    if (data.mode === 'identitas') {
      if (!data.nama.trim())  e.nama  = 'Nama wajib diisi'
      if (!data.noHp.trim())  e.noHp  = 'Nomor HP wajib diisi'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleNext = () => { if (validate()) onNext() }

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="mb-8">
        <div className="text-alert text-[12px] font-bold tracking-[0.18em] uppercase mb-3">
          IDENTITAS PELAPOR
        </div>
        <h2 className="font-bold text-[32px] md:text-[40px] leading-[1.05] tracking-[-0.02em]">
          Siapa yang melaporkan?
        </h2>
        <p className="mt-3 text-gray-500 text-[15px] leading-relaxed">
          Anda dapat melapor secara anonim. Identitas Anda dilindungi dan hanya dapat diakses petugas berwenang.
        </p>
      </div>

      {/* Mode toggle */}
      <div className="mb-8 grid grid-cols-2 border border-gray-200 r4 overflow-hidden">
        {(['identitas', 'anonim'] as const).map(mode => (
          <button
            key={mode}
            type="button"
            onClick={() => setData({ mode })}
            className={`py-4 text-[13px] font-bold tracking-[0.06em] uppercase transition-all duration-200
              ${data.mode === mode ? 'bg-ink text-white' : 'bg-white text-gray-400 hover:bg-gray-50'}`}
          >
            {mode === 'identitas' ? '🔐 Dengan Identitas' : '👤 Anonim'}
          </button>
        ))}
      </div>

      {data.mode === 'anonim' && (
        <div className="mb-8 border border-gray-200 r4 px-5 py-4 bg-gray-50">
          <p className="mono text-[11px] uppercase tracking-[0.16em] text-gray-500">
            MODE ANONIM AKTIF
          </p>
          <p className="mt-2 text-[14px] text-gray-600 leading-relaxed">
            Laporan Anda akan diproses tanpa menyimpan identitas pribadi. Nomor tiket tetap diberikan untuk pelacakan.
          </p>
        </div>
      )}

      {data.mode === 'identitas' && (
        <div className="space-y-5">
          <div>
            <FieldLabel required>Nama Lengkap</FieldLabel>
            <Input
              value={data.nama}
              onChange={v => setData({ nama: v })}
              placeholder="Masukkan nama lengkap Anda"
            />
            <ValidationMsg msg={errors.nama} />
          </div>
          <div>
            <FieldLabel required>Nomor HP / WhatsApp</FieldLabel>
            <Input
              type="tel"
              value={data.noHp}
              onChange={v => setData({ noHp: v })}
              placeholder="08xx-xxxx-xxxx"
            />
            <ValidationMsg msg={errors.noHp} />
          </div>
          <div>
            <FieldLabel>Email <span className="normal-case font-normal text-gray-400">(opsional)</span></FieldLabel>
            <Input
              type="email"
              value={data.email}
              onChange={v => setData({ email: v })}
              placeholder="nama@email.com"
            />
          </div>
        </div>
      )}

      <div className="mt-10 flex justify-end">
        <button
          type="button"
          onClick={handleNext}
          className="r4 bg-ink text-white font-bold text-[13px] tracking-[0.08em] uppercase
                     px-8 py-4 hover:bg-black transition-colors duration-200 btnPress"
        >
          Lanjut ke Detail Kejadian →
        </button>
      </div>
    </div>
  )
}

/* ============================================================
   STEP 2 — DETAIL KEJADIAN
   ============================================================ */
function Step2({
  data, setData, onNext, onBack,
}: {
  data: FormData
  setData: (d: Partial<FormData>) => void
  onNext: () => void
  onBack: () => void
}) {
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const e: Record<string, string> = {}
    if (!data.judul.trim())     e.judul    = 'Judul laporan wajib diisi'
    if (!data.lokasi.trim())    e.lokasi   = 'Lokasi wajib diisi'
    if (!data.deskripsi.trim()) e.deskripsi = 'Kronologi wajib diisi (min. 50 karakter)'
    else if (data.deskripsi.trim().length < 50)
      e.deskripsi = 'Kronologi terlalu singkat (min. 50 karakter)'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleNext = () => { if (validate()) onNext() }

  const charCount  = data.deskripsi.trim().length
  const charStatus = charCount === 0 ? 'empty' : charCount < 50 ? 'short' : 'ok'

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="mb-8">
        <div className="text-alert text-[12px] font-bold tracking-[0.18em] uppercase mb-3">
          DETAIL KEJADIAN
        </div>
        <h2 className="font-bold text-[32px] md:text-[40px] leading-[1.05] tracking-[-0.02em]">
          Apa yang terjadi?
        </h2>
        <p className="mt-3 text-gray-500 text-[15px] leading-relaxed">
          Semakin detail kronologi yang Anda berikan, semakin akurat sistem AI dapat mengklasifikasikan urgensi laporan.
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <FieldLabel required>Judul Singkat Laporan</FieldLabel>
          <Input
            value={data.judul}
            onChange={v => setData({ judul: v })}
            placeholder="cth: Pencurian motor di parkiran Alfamart"
          />
          <ValidationMsg msg={errors.judul} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <FieldLabel required>Lokasi Kejadian</FieldLabel>
            <Input
              value={data.lokasi}
              onChange={v => setData({ lokasi: v })}
              placeholder="cth: Jl. Sudirman No. 45, Jakarta Pusat"
            />
            <ValidationMsg msg={errors.lokasi} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Tanggal</FieldLabel>
              <Input type="date" value={data.tanggal} onChange={v => setData({ tanggal: v })} />
            </div>
            <div>
              <FieldLabel>Waktu</FieldLabel>
              <Input type="time" value={data.waktu} onChange={v => setData({ waktu: v })} />
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-2">
            <FieldLabel required>Kronologi Lengkap</FieldLabel>
            <span className={`mono text-[11px] tracking-[0.08em]
              ${charStatus === 'ok' ? 'text-green-600' : charStatus === 'short' ? 'text-alert' : 'text-gray-400'}`}>
              {charCount} / min 50 karakter
            </span>
          </div>
          <Textarea
            value={data.deskripsi}
            onChange={v => setData({ deskripsi: v })}
            rows={7}
            placeholder="Ceritakan kejadian secara runtut: siapa yang terlibat, apa yang terjadi, kapan dan di mana persisnya, bagaimana kejadian berlangsung..."
          />
          <ValidationMsg msg={errors.deskripsi} />
          <p className="mt-2 mono text-[10px] uppercase tracking-[0.14em] text-gray-400">
            Teks ini dianalisis oleh AI untuk menentukan tingkat urgensi laporan
          </p>
        </div>
      </div>

      <div className="mt-10 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="r4 bg-white text-ink font-bold text-[13px] tracking-[0.08em] uppercase
                     px-6 py-4 border border-ink hover:bg-gray-50 transition-colors duration-200"
        >
          ← Kembali
        </button>
        <button
          type="button"
          onClick={handleNext}
          className="r4 bg-ink text-white font-bold text-[13px] tracking-[0.08em] uppercase
                     px-8 py-4 hover:bg-black transition-colors duration-200 btnPress"
        >
          Lanjut ke Bukti →
        </button>
      </div>
    </div>
  )
}

/* ============================================================
   STEP 3 — BUKTI & KONFIRMASI
   ============================================================ */
function Step3({
  data, setData, onSubmit, onBack, submitting,
}: {
  data: FormData
  setData: (d: Partial<FormData>) => void
  onSubmit: () => void
  onBack: () => void
  submitting: boolean
}) {
  const [dragOver, setDragOver] = useState(false)
  const [previews, setPreviews] = useState<UploadedFile[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const addFiles = useCallback((incoming: FileList | null) => {
    if (!incoming) return
    const valid = Array.from(incoming).filter(f => {
      const ok = f.type.startsWith('image/') || f.type.startsWith('video/') || f.type === 'application/pdf'
      return ok && f.size <= 50 * 1024 * 1024 // 50MB per file
    })
    const newPreviews = valid.map(file => ({
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
    }))
    setPreviews(prev => [...prev, ...newPreviews].slice(0, 10))
    setData({ files: [...data.files, ...valid].slice(0, 10) })
  }, [data.files, setData])

  const removeFile = (i: number) => {
    const next = previews.filter((_, idx) => idx !== i)
    setPreviews(next)
    setData({ files: next.map(p => p.file) })
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="mb-8">
        <div className="text-alert text-[12px] font-bold tracking-[0.18em] uppercase mb-3">
          BUKTI &amp; KONFIRMASI
        </div>
        <h2 className="font-bold text-[32px] md:text-[40px] leading-[1.05] tracking-[-0.02em]">
          Lampirkan bukti
        </h2>
        <p className="mt-3 text-gray-500 text-[15px] leading-relaxed">
          Foto, video, atau dokumen pendukung mempercepat penanganan laporan. Maks. 10 file, 50 MB per file.
        </p>
      </div>

      {/* Upload zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files) }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed r4 p-10 text-center cursor-pointer transition-all duration-200
          ${dragOver ? 'border-ink bg-gray-50' : 'border-gray-200 hover:border-gray-400'}`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,video/*,application/pdf"
          className="hidden"
          onChange={e => addFiles(e.target.files)}
        />
        <div className="mono text-[32px] mb-3 select-none">📎</div>
        <p className="font-bold text-[15px]">
          {dragOver ? 'Lepaskan file di sini' : 'Klik atau seret file ke sini'}
        </p>
        <p className="mt-2 mono text-[11px] uppercase tracking-[0.14em] text-gray-400">
          JPG · PNG · MP4 · PDF — Maks. 10 file
        </p>
      </div>

      {/* File previews */}
      {previews.length > 0 && (
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {previews.map((p, i) => (
            <div key={i} className="relative group border border-gray-200 r4 overflow-hidden aspect-square bg-gray-50">
              {p.preview ? (
                <img src={p.preview} alt={p.file.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-3">
                  <span className="text-2xl mb-2">📄</span>
                  <span className="mono text-[9px] uppercase tracking-wide text-gray-400 text-center break-all line-clamp-2">
                    {p.file.name}
                  </span>
                </div>
              )}
              {/* Overlay on hover */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-1">
                <span className="text-white text-[11px] font-bold text-center px-2 line-clamp-2">{p.file.name}</span>
                <span className="mono text-white/70 text-[10px]">{formatSize(p.file.size)}</span>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); removeFile(i) }}
                  className="mt-2 bg-alert text-white mono text-[10px] uppercase tracking-wide px-3 py-1 r4"
                >
                  Hapus
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ringkasan laporan */}
      <div className="mt-8 border border-gray-200 r4 overflow-hidden">
        <div className="bg-gray-50 px-5 py-3 border-b border-gray-200">
          <span className="mono text-[11px] uppercase tracking-[0.18em] font-bold text-gray-500">
            RINGKASAN LAPORAN
          </span>
        </div>
        <div className="divide-y divide-gray-100">
          {[
            ['Pelapor',   data.mode === 'anonim' ? 'Anonim'   : data.nama || '—'],
            ['Lokasi',    data.lokasi   || '—'],
            ['Waktu',     [data.tanggal, data.waktu].filter(Boolean).join(' · ') || '—'],
            ['Bukti',     `${previews.length} file dilampirkan`],
          ].map(([k, v]) => (
            <div key={k} className="px-5 py-3 flex gap-6">
              <span className="mono text-[11px] uppercase tracking-[0.14em] text-gray-400 w-24 shrink-0 pt-[1px]">{k}</span>
              <span className="text-[14px] font-medium">{v}</span>
            </div>
          ))}
          <div className="px-5 py-3">
            <span className="mono text-[11px] uppercase tracking-[0.14em] text-gray-400 block mb-2">Kronologi</span>
            <p className="text-[14px] leading-relaxed text-gray-700 line-clamp-3">{data.deskripsi || '—'}</p>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="mt-5 flex gap-3 items-start">
        <span className="mono text-[10px] text-gray-400 leading-relaxed">
          Dengan mengirimkan laporan ini, Anda menyatakan bahwa informasi yang diberikan adalah benar dan dapat dipertanggungjawabkan.
          Pelaporan palsu dapat dikenakan sanksi sesuai Pasal 220 KUHP.
        </span>
      </div>

      <div className="mt-8 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="r4 bg-white text-ink font-bold text-[13px] tracking-[0.08em] uppercase
                     px-6 py-4 border border-ink hover:bg-gray-50 transition-colors duration-200 disabled:opacity-50"
        >
          ← Kembali
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="r4 bg-ink text-white font-bold text-[13px] tracking-[0.08em] uppercase
                     px-10 py-4 hover:bg-black transition-all duration-200 btnPress
                     disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-3"
        >
          {submitting ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Mengirim...
            </>
          ) : 'Kirim Laporan'}
        </button>
      </div>
    </div>
  )
}

/* ============================================================
   SUCCESS STATE
   ============================================================ */
const URGENSI_STYLE: Record<string, { bg: string; color: string }> = {
  Tinggi: { bg: '#cc0000', color: '#ffffff' },
  Sedang: { bg: '#0a0a0a', color: '#ffffff' },
  Rendah: { bg: '#e5e7eb', color: '#0a0a0a' },
}

const URGENSI_ESTIMASI: Record<string, string> = {
  Tinggi: '< 2 Jam',
  Sedang: '< 24 Jam',
  Rendah: '< 72 Jam',
}

function SuccessState({ ticketId, urgensi }: { ticketId: string; urgensi: string }) {
  const style = URGENSI_STYLE[urgensi] ?? URGENSI_STYLE.Sedang

  return (
    <div className="text-center py-8 animate-in fade-in zoom-in-95 duration-500">
      {/* Icon */}
      <div className="inline-flex items-center justify-center w-20 h-20 border-2 border-ink r4 mb-8 bg-ink">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <path d="M6 16l8 8 12-14" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      <div className="text-alert text-[12px] font-bold tracking-[0.18em] uppercase mb-4">
        LAPORAN DITERIMA
      </div>
      <h2 className="font-bold text-[36px] md:text-[48px] leading-[1.05] tracking-[-0.02em]">
        Laporan berhasil dikirim
      </h2>
      <p className="mt-4 text-gray-500 text-[16px] leading-relaxed max-w-[480px] mx-auto">
        Laporan Anda sedang dianalisis oleh sistem AI dan akan segera diteruskan ke unit kepolisian yang tepat.
      </p>

      {/* Ticket ID */}
      <div className="mt-10 inline-block border-2 border-ink r4 px-8 py-6">
        <div className="mono text-[11px] uppercase tracking-[0.18em] text-gray-500 mb-2">
          NOMOR TIKET ANDA
        </div>
        <div className="font-bold text-[32px] tracking-[0.04em] text-ink">
          {ticketId}
        </div>
        <p className="mt-2 text-[13px] text-gray-500">
          Simpan nomor ini untuk melacak status laporan
        </p>
      </div>

      {/* ML Result badge */}
      <div className="mt-8">
        <div className="mono text-[10px] uppercase tracking-[0.18em] text-gray-400 mb-3">
          HASIL ANALISIS ML
        </div>
        <span
          className="inline-block font-bold text-[13px] tracking-[0.12em] uppercase px-6 py-2 r4"
          style={{ backgroundColor: style.bg, color: style.color }}
        >
          URGENSI {urgensi}
        </span>
      </div>

      {/* Info grid */}
      <div className="mt-8 grid grid-cols-2 border border-gray-200 r4 overflow-hidden max-w-xs mx-auto">
        {[
          ['Status',   'Diterima'],
          ['Estimasi', URGENSI_ESTIMASI[urgensi] ?? '< 24 Jam'],
        ].map(([k, v], i) => (
          <div key={k} className={`px-4 py-4 ${i < 1 ? 'border-r border-gray-200' : ''}`}>
            <div className="mono text-[10px] uppercase tracking-[0.16em] text-gray-400">{k}</div>
            <div className="mt-1 font-bold text-[14px]">{v}</div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link
          href={`/?cek=${ticketId}`}
          className="r4 bg-ink text-white font-bold text-[13px] tracking-[0.08em] uppercase
                     px-8 py-4 hover:bg-black transition-colors duration-200 inline-flex items-center gap-2"
        >
          Cek Status Laporan
        </Link>
        <Link
          href="/"
          className="r4 bg-white text-ink font-bold text-[13px] tracking-[0.08em] uppercase
                     px-8 py-4 border border-ink hover:bg-gray-50 transition-colors duration-200"
        >
          Kembali ke Beranda
        </Link>
      </div>
    </div>
  )
}

/* ============================================================
   PAGE — default export
   ============================================================ */
const INITIAL_DATA: FormData = {
  mode:      'identitas',
  nama:      '',
  noHp:      '',
  email:     '',
  judul:     '',
  lokasi:    '',
  tanggal:   '',
  waktu:     '',
  deskripsi: '',
  files:     [],
}

export default function LaporanPage() {
  const [step,       setStep]       = useState(0)
  const [formData,   setFormData]   = useState<FormData>(INITIAL_DATA)
  const [submitting, setSubmitting] = useState(false)
  const [ticketId,   setTicketId]   = useState('')
  const [urgensi,    setUrgensi]    = useState('')

  const update = (partial: Partial<FormData>) =>
    setFormData(prev => ({ ...prev, ...partial }))

  const handleSubmit = async () => {
    setSubmitting(true)

    const payload = {
      judul:          formData.judul,
      deskripsi:      formData.deskripsi,
      lokasi:         formData.lokasi,
      nama_pelapor:   formData.mode === 'identitas' ? formData.nama  : null,
      kontak_pelapor: formData.mode === 'identitas' ? formData.noHp  : null,
      is_anonim:      formData.mode === 'anonim',
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/api/laporan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.detail || 'Gagal mengirim laporan')
      }

      const result = await response.json()
      setTicketId(result.ticket_id)
      setUrgensi(result.analisis.kategori)

      if (formData.files && formData.files.length > 0) {
        const fData = new FormData()
        formData.files.forEach((f: File) => fData.append('files', f))
        try {
          await fetch(`${apiUrl}/api/laporan/${result.ticket_id}/foto`, {
            method: 'POST',
            body: fData,
          })
        } catch (err) {
          console.error('Upload foto gagal:', err)
        }
      }

      setStep(3)
    } catch (error) {
      alert('Terjadi kesalahan: ' + error)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* ── Navbar ── */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="max-w-[1240px] mx-auto px-6 h-[64px] flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 hover:opacity-70 transition-opacity">
            <LogoBox />
            <span className="font-bold tracking-[0.08em] text-[15px]">SIPEDULI</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="mono text-[11px] uppercase tracking-[0.16em] text-gray-400 hidden sm:block">
              Portal Pelaporan
            </span>
            <ThemeToggle />
            <Link
              href="/"
              className="mono text-[11px] uppercase tracking-[0.16em] text-gray-500 hover:text-ink
                         border border-gray-200 r4 px-4 py-2 hover:border-gray-400 transition-colors"
            >
              ← Beranda
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-[760px] mx-auto px-6 py-12 md:py-20">
        {step < 3 ? (
          <>
            {/* Step Indicator */}
            <div className="mb-12 border border-gray-200 r4 overflow-hidden">
              <StepIndicator current={step} />
            </div>

            {/* Step Content */}
            {step === 0 && (
              <Step1 data={formData} setData={update} onNext={() => setStep(1)} />
            )}
            {step === 1 && (
              <Step2
                data={formData}
                setData={update}
                onNext={() => setStep(2)}
                onBack={() => setStep(0)}
              />
            )}
            {step === 2 && (
              <Step3
                data={formData}
                setData={update}
                onSubmit={handleSubmit}
                onBack={() => setStep(1)}
                submitting={submitting}
              />
            )}
          </>
        ) : (
          <SuccessState ticketId={ticketId} urgensi={urgensi} />
        )}
      </main>

      {/* ── Footer strip ── */}
      <footer className="border-t border-gray-200 mt-20">
        <div className="max-w-[1240px] mx-auto px-6 py-5 flex items-center justify-between">
          <span className="mono text-[11px] uppercase tracking-[0.16em] text-gray-400">
            © 2025 SIPEDULI · Republik Indonesia
          </span>
          <span className="mono text-[11px] uppercase tracking-[0.16em] text-gray-400">
            NOMOR DARURAT: <strong className="text-ink">110</strong>
          </span>
        </div>
      </footer>
    </div>
  )
}
