# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Baca file ini sepenuhnya sebelum menyentuh kode apapun.

---

## 1. PROJECT OVERVIEW

**SIPEDULI** — Sistem Pelaporan Kejahatan Terpadu  
**Jenis:** Project UAS (Machine Learning + Web Service + Data Mining)  
**GitHub:** https://github.com/toikkkk/crime_reporting.git

**Konsep:** Portal pelaporan kejahatan berbasis web. Masyarakat isi form → ML klasifikasi urgensi otomatis → Polisi kelola via dashboard.

```
User isi kronologi → FastAPI /predict → ML klasifikasi →
label urgensi tersimpan di Supabase → tampil di dashboard admin
```

---

## 2. COMMANDS

### Full Stack (Docker)
```bash
docker-compose up -d          # Start semua service
docker-compose down
docker-compose logs backend
```

### Backend (local dev)
```bash
cd backend
# Aktifkan venv: .\venv311\Scripts\activate  (Windows, dari root)
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
# One-time setup: python -c "import nltk; nltk.download('stopwords')"
```
API docs: `http://localhost:8000/docs`

### Frontend (local dev)
```bash
cd frontend
npm install
npm run dev    # http://localhost:3000
npm run build
```

> **PENTING — Next.js 16.2:** Versi ini punya breaking changes dari training data LLM.
> Sebelum edit frontend, cek `node_modules/next/dist/docs/` untuk API yang benar.
> Jangan asumsikan konvensi Next.js lama masih berlaku.
> `frontend/AGENTS.md` mengandung peringatan serupa — dibaca otomatis saat bekerja di folder `frontend/`.

### Database
```bash
python scripts/migrate_csv_to_db.py --env local        # CSV → PostgreSQL lokal
python scripts/migrate_csv_to_db.py --env production   # CSV → Supabase
python scripts/test_koneksi.py
```
Schema awal: `scripts/init.sql` — diload otomatis Docker saat pertama jalan.

### ML
```bash
python backend/app/ml/preprocessor.py   # Quick test preprocessing pipeline
```
MLflow UI: `http://localhost:5000` (via Docker)

### Env vars kritis (`.env`)
```
POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB
SUPABASE_URL / SUPABASE_KEY
SECRET_KEY
NEXT_PUBLIC_API_URL=http://localhost:8000   # dipakai frontend Docker image
```

---

## 3. TECH STACK

### Services (Docker Compose)
| Service    | Port | Keterangan              |
|------------|------|-------------------------|
| `db`       | 5432 | PostgreSQL 16           |
| `mlflow`   | 5000 | MLflow Tracking Server  |
| `backend`  | 8000 | FastAPI                 |
| `frontend` | 3000 | Next.js                 |

### Frontend
- **Next.js 16.2.6** (App Router) + **TypeScript 5** + **React 19**
- **TailwindCSS v4** — konfigurasi warna via `@theme` di `globals.css`, **BUKAN** di `tailwind.config.ts`

### Backend
- **FastAPI 0.115** + **Python** (venv: `venv311/`)
- **Supabase** (PostgreSQL) sebagai database
- **SQLAlchemy 2.0** + **Alembic** untuk ORM/migrasi
- **python-jose** + **passlib[bcrypt]** untuk auth

### ML
- **TF-IDF** vectorizer + classifier (LinearSVC/LR/RF)
- **Sastrawi** untuk Indonesian stemming
- **File model:** `model_final.pkl`, `vectorizer.pkl`, `model_metadata.json` (gitignored — regenerate dari `notebooks/02_modeling.ipynb`)
- **Input:** `deskripsi_bersih` | **Output:** label urgensi + confidence score

---

## 4. ARSITEKTUR

### Backend (`backend/app/`)
```
app/
├── main.py          # FastAPI entry. Semua router masih di-comment — hanya /health & / aktif.
├── core/config.py   # Settings via pydantic-settings. Key: DATABASE_URL, SUPABASE_URL,
│                    #   MLFLOW_TRACKING_URI, SECRET_KEY, ALLOWED_ORIGINS
├── api/             # Route handlers — semua __init__.py kosong, belum ada implementasi
├── db/              # Database models & koneksi — __init__.py kosong
├── schemas/         # Pydantic request/response schemas — __init__.py kosong
├── services/        # Business logic — __init__.py kosong
└── ml/
    ├── preprocessor.py   # Production inference pipeline (lengkap, bisa dijalankan)
    └── models/           # Model artifacts (gitignored) — di luar folder app/
```

> **Catatan path:** Model artifacts tersimpan di `backend/ml/models/` (satu level di atas `app/`),
> bukan `backend/app/ml/models/`. Docker volume `model_artifacts` mount ke `/app/ml/models`.

### Frontend (`frontend/app/`)
```
app/
├── page.tsx                    # Landing page publik
├── layout.tsx                  # Root layout (ThemeProvider ada di sini — JANGAN duplikat)
├── globals.css                 # Global styles + Tailwind @theme
├── laporan/
│   ├── page.tsx                # Wrapper — hanya re-export laporan_page.tsx
│   └── laporan_page.tsx        # Komponen utama form 3-step ('use client')
│                               # handleSubmit() masih simulasi setTimeout + random urgensi
│                               # generateTicketId() di sini bersifat sementara — harusnya dari DB trigger
├── admin/
│   ├── login/page.tsx          # Login admin
│   └── dashboard/
│       ├── page.tsx            # Dashboard admin — data REPORTS & NOTIFICATIONS masih hardcoded
│       └── dashboard.css       # CSS khusus dashboard (SVG peta Indonesia, animasi panel)
└── components/
    ├── ThemeProvider.tsx        # Context dark mode + curtain animation
    └── ThemeToggle.tsx          # Tombol toggle moon/sun
```

### Database Schema (PostgreSQL)
Lima tabel di `scripts/init.sql`:
- `laporan` — Laporan warga; ticket ID (`CRM-YYYY-NNNN`) auto-generate via DB trigger
- `training_data` — Korpus training ML
- `foto_bukti` — Foto bukti di Supabase Storage
- `petugas` — Akun polisi/admin (bcrypt password)
- `ml_models` — Ringkasan MLflow experiment runs

PostgreSQL ENUMs:
- `urgensi_level`: `Tinggi` / `Sedang` / `Rendah`
- `status_laporan`: `Diterima` / `Dianalisis` / `Dalam Penyelidikan` / `Selesai` / `Ditolak`

**Tabel `laporan`:**
```sql
CREATE TABLE laporan (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id        TEXT UNIQUE NOT NULL,
  nama_pelapor     TEXT,
  mode_pelaporan   TEXT DEFAULT 'anonim',
  no_hp            TEXT,
  email            TEXT,
  judul_laporan    TEXT NOT NULL,
  deskripsi        TEXT NOT NULL,
  lokasi           TEXT,
  tanggal          TEXT,
  waktu            TEXT,
  label_urgensi    TEXT,
  confidence_score FLOAT,
  keywords         TEXT,
  status           TEXT DEFAULT 'Diterima',
  foto_bukti       TEXT[],
  created_at       TIMESTAMP DEFAULT NOW()
);
```

---

## 5. DESIGN SYSTEM — NON-NEGOTIABLE

> Jangan ubah apapun di sini tanpa diskusi.

### Warna
```
ink   = #0a0a0a  → background gelap, button primary, text utama di dark mode
alert = #cc0000  → aksen merah, badge Tinggi, label section
white = #ffffff  → background halaman (light mode)
gray  = border (#e5e7eb), text secondary (#6b7280)
amber = #ffc107  → badge Sedang (hanya dashboard)
green = #28a745  → badge Rendah (hanya dashboard)
```

Didefinisikan di `globals.css` via `@theme { --color-ink: ...; --color-alert: ...; }`.

### Tipografi
- `DM Sans` → heading dan body text
- `JetBrains Mono` → SEMUA label kecil uppercase (`class="mono"`)

### Aturan Desain
- Border radius: 4px maksimal (`class="r4"`)
- Feel: government-grade, editorial brutalist minimal
- Label kecil: mono uppercase `tracking-widest`
- TIDAK ada gradient, TIDAK ada ilustrasi
- Footer `bg-ink` selalu hitam → pakai `class="keep-ink"` agar dark mode tidak override

### Dark Mode
- Toggle via `html.dark` class di `<html>` — **BUKAN** Tailwind `dark:` prefix
- `ThemeProvider` sudah di `layout.tsx` — jangan duplikat di halaman lain
- `localStorage` key: `'sipeduli-theme'`
- Curtain animation saat toggle (falling/rising)

### CSS Classes Penting (`globals.css`)
```
.reveal / .reveal.in    → scroll reveal animation
.heroAnim               → staggered entrance animation
.heroTitle .word        → word blur reveal (hero heading)
.cs-card / .cs-wrap     → perspective scroll effect
.redLabel               → underline grow animation
.lift                   → card hover lift
.magBtn / .sweep        → magnetic button effect
.curtain                → fullscreen curtain transition
.hero-grid              → animated dotted grid background
.faqBody / .faqBody.open → FAQ collapse animation
.livePulse / .ringPulse → pulse animations
.tlBar                  → timeline progress fill
```

---

## 6. ML PIPELINE

### Dataset
- 3.771 baris (2.413 real + 1.358 synthetic SMOTE), perfectly balanced per label
- `Tinggi` → ancaman nyawa, pidana > 5 tahun (KUHP 340, 285, dll)
- `Sedang` → kerugian harta, 2-5 tahun
- `Rendah` → ketertiban umum, < 2 tahun / denda

### Preprocessing Pipeline (production — `ml/preprocessor.py`)
1. Normalisasi informal → formal (60+ kata: `maling`→`pencuri`, dll)
2. Cleaning (hapus URL, email, angka, simbol)
3. Hapus stopwords — **`tidak` dan `sangat` sengaja TIDAK dihapus** (mengubah makna urgensi)
4. Stemming (Sastrawi)
5. Relabeling otomatis berbasis konten

SMOTE balancing hanya di notebook (offline), tidak di production.

---

## 7. INTEGRASI FE ↔ BACKEND

### Endpoint
```
POST /predict             → { teks: string } → { label_urgensi, confidence_score }
POST /laporan             → simpan laporan ke Supabase
GET  /laporan             → semua laporan untuk dashboard
GET  /laporan/:id         → detail satu laporan
PATCH /laporan/:id/status → update status
```

### Pending di Frontend

**1. `app/laporan/laporan_page.tsx` — `handleSubmit()`** masih pakai simulasi `setTimeout(2000)` + urgensi random.
Ganti dengan:
```typescript
const res = await fetch('http://localhost:8000/predict', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ teks: formData.deskripsi })
})
const { label_urgensi, confidence_score } = await res.json()
```

**2. `app/admin/dashboard/page.tsx`** — array `REPORTS` dan `NOTIFICATIONS` hardcoded.
Harus diganti dengan fetch ke `GET /laporan` setelah backend router aktif.

**3. Ticket ID** — fungsi `generateTicketId()` di frontend hanya placeholder.
Seharusnya berasal dari response `POST /laporan` (DB trigger menghasilkan `CRM-YYYY-NNNN`).

---

## 8. KONVENSI KODE

- **Bahasa Indonesia** di variable name, komentar, field DB, dan UI text
- **Urgensi:** selalu `Tinggi` / `Sedang` / `Rendah` (kapital di awal) — match PostgreSQL ENUM
- **`.env` gitignored** — jangan pernah commit
- **Model artifacts gitignored** — regenerate dari `notebooks/02_modeling.ipynb`
