# CLAUDE.md — SIPEDULI

> Baca file ini sepenuhnya sebelum menyentuh kode apapun.
> Ini adalah source of truth untuk konvensi, constraint, dan status project.

---

## 1. PROJECT OVERVIEW

**SIPEDULI** — Sistem Pelaporan Kejahatan Terpadu  
**Jenis:** Project UAS (Machine Learning + Web Service + Data Mining)  
**GitHub:** https://github.com/toikkkk/crime_reporting.git  
**Tim:** 3 orang — ML/Frontend (Toik), Backend (teman)

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
docker-compose down           # Stop semua service
docker-compose logs backend   # Lihat log backend
```

### Backend (local dev)
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
# API docs: http://localhost:8000/docs
# Jalankan sekali: nltk.download('stopwords')
```

### Frontend (local dev)
```bash
cd frontend
npm install
npm run dev    # http://localhost:3000
npm run build
```

### Database
```bash
python scripts/migrate_csv_to_db.py --env local        # CSV → PostgreSQL lokal
python scripts/migrate_csv_to_db.py --env production   # CSV → Supabase
python scripts/test_koneksi.py                         # Test koneksi DB
```
Schema awal ada di `scripts/init.sql` — diload otomatis oleh Docker saat pertama jalan.

### ML
```bash
python backend/app/ml/preprocessor.py   # Quick test preprocessing pipeline
```
MLflow UI: `http://localhost:5000` (via Docker)

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
- **Next.js 16.2** (App Router) + **TypeScript**
- **TailwindCSS v4** — konfigurasi warna via `@theme` di `globals.css`, BUKAN di `tailwind.config.ts`
- **React 19**
- **Deployment:** Laragon (Windows, local)

### Backend
- **FastAPI** + **Python**
- **Supabase** (PostgreSQL) sebagai database

### ML
- **TF-IDF** vectorizer + classifier (LinearSVC/LR/RF)
- **File model:** `model_final.pkl`, `vectorizer.pkl`, `model_metadata.json`
- **Input:** `deskripsi_bersih` (teks kronologi yang sudah dipreprocessing)
- **Output:** label urgensi + confidence score

---

## 4. ARSITEKTUR

### Backend (`backend/app/`)
- **`main.py`** — FastAPI entry point. Router (`laporan`, `auth`, `admin`, `predict`) masih di-comment, ditambah inkremental.
- **`core/config.py`** — `Settings` via pydantic-settings; baca dari `.env`. Key: `DATABASE_URL`, `SUPABASE_URL`, `MLFLOW_TRACKING_URI`, `SECRET_KEY`.
- **`ml/preprocessor.py`** — Pipeline inference production: normalisasi informal→formal → cleaning → stopword removal → stemming Sastrawi → keyword extraction. SMOTE hanya di notebook (offline).
- **`ml/models/`** — Artifact model (gitignored; regenerate dari notebooks).

### Frontend (`frontend/app/`)
- **`page.tsx`** — Landing page publik.
- **`laporan/page.tsx`** — Form laporan 3-step (publik).
- **`admin/login/page.tsx`** — Login admin.
- **`admin/dashboard/page.tsx`** — Dashboard admin (data masih hardcoded/dummy).
- **`components/ThemeProvider.tsx`** — Context dark mode + curtain animation.
- **`components/ThemeToggle.tsx`** — Tombol toggle moon/sun.

### Database Schema (PostgreSQL)
Lima tabel utama di `scripts/init.sql`:
- `training_data` — Korpus training ML (dari migrasi CSV)
- `laporan` — Laporan warga; ticket ID (`CRM-YYYY-NNNN`) auto-generate via DB trigger
- `foto_bukti` — Foto bukti di Supabase Storage
- `petugas` — Akun polisi/admin (bcrypt password)
- `ml_models` — Ringkasan MLflow experiment runs untuk dashboard

PostgreSQL ENUMs:
- `urgensi_level`: `Tinggi` / `Sedang` / `Rendah`
- `status_laporan`: `Diterima` / `Dianalisis` / `Dalam Penyelidikan` / `Selesai` / `Ditolak`

**Tabel `laporan` (schema lengkap):**
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

> Jangan ubah apapun di sini tanpa diskusi. Ini constraint desain yang sudah final.

### Warna
```
ink   = #0a0a0a  → background gelap, button primary, text utama di dark mode
alert = #cc0000  → aksen merah, badge Tinggi, label section
white = #ffffff  → background halaman (light mode)
gray  = border (#e5e7eb), text secondary (#6b7280)
amber = #ffc107  → badge Sedang (hanya dashboard)
green = #28a745  → badge Rendah (hanya dashboard)
```

Didefinisikan di `globals.css`:
```css
@theme {
  --color-ink: #0a0a0a;
  --color-alert: #cc0000;
}
```
**BUKAN** di `tailwind.config.ts`.

### Tipografi
```
DM Sans        → semua heading dan body text
JetBrains Mono → SEMUA label kecil uppercase (class: mono)
```

### Aturan Desain
```
- Border radius: 4px MAKSIMAL di semua elemen (class: r4)
- Feel: government-grade, editorial brutalist minimal
- Semua label kecil: mono uppercase tracking-widest
- TIDAK ada gradient, TIDAK ada ilustrasi
- Footer bg-ink selalu hitam → pakai class keep-ink (dark mode tidak override)
```

### Dark Mode
```
- Toggle via html.dark class di <html> — BUKAN Tailwind dark: prefix
- ThemeProvider sudah di layout.tsx — JANGAN duplikat di halaman lain
- localStorage key: 'sipeduli-theme'
- Curtain animation saat toggle (falling/rising)
```

### CSS Classes Penting (`globals.css`)
```
.reveal / .reveal.in    → scroll reveal animation
.heroAnim               → staggered entrance animation
.heroTitle .word        → word blur reveal (hero heading)
.cs-card / .cs-wrap     → perspective scroll effect
.redLabel               → underline grow animation
.lift                   → card hover lift
.magBtn / .sweep        → magnetic button effect
.theme-toggle           → dark mode toggle button
.curtain                → fullscreen curtain transition
.hero-grid              → animated dotted grid background
.grid-sq                → accent squares on grid
.float-mark             → floating ambient SVG marks
.faqBody / .faqBody.open → FAQ collapse animation
.livePulse / .ringPulse → pulse animations
.tlBar                  → timeline progress fill
```

---

## 6. ML PIPELINE

### Dataset Final
```
Total: 3.771 baris (2.413 real + 1.358 synthetic SMOTE)
Label: Tinggi 1.257 / Sedang 1.257 / Rendah 1.257 (perfectly balanced)
Feature (X): deskripsi_bersih
Target (y):  label_urgensi
```

### Dasar Label Urgensi
```
Tinggi → ancaman nyawa langsung, pidana > 5 tahun (KUHP 340, 285, dll)
Sedang → kerugian harta/pelanggaran serius, 2-5 tahun
Rendah → ketertiban umum, < 2 tahun / denda
Referensi: SARA Model (kepolisian) + ancaman pidana KUHP
```

### Preprocessing Pipeline
```
1. Normalisasi informal → formal (60+ kata: maling→pencuri, dll)
2. Cleaning (hapus URL, email, angka, simbol)
3. Hapus stopwords (60+ kata Bahasa Indonesia)
   ⚠ PENTING: tidak dan sangat SENGAJA tidak dihapus
      → mengubah makna urgensi ("tidak ada korban" vs "ada korban")
4. Stemming (Sastrawi)
5. Relabeling otomatis berbasis konten
6. SMOTE balancing (offline, hanya di notebook)
```

---

## 7. INTEGRASI FE ↔ BACKEND

### Endpoint yang Dibutuhkan
```
POST /predict           → { teks: string } → { label_urgensi, confidence_score }
POST /laporan           → simpan laporan ke Supabase
GET  /laporan           → ambil semua laporan untuk dashboard
GET  /laporan/:id       → detail satu laporan
PATCH /laporan/:id/status → update status laporan
```

### Implementasi di Frontend (belum dilakukan)
Di `app/laporan/page.tsx`, fungsi `handleSubmit()`:
```typescript
// GANTI simulasi ini:
await new Promise(r => setTimeout(r, 2000))

// DENGAN:
const res = await fetch('http://localhost:8000/predict', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ teks: formData.deskripsi })
})
const { label_urgensi, confidence_score } = await res.json()
```

---

## 8. PROGRESS STATUS

### ✅ Selesai
- Data scraping (detik.com) + preprocessing pipeline + ML modeling
- Landing page (`/`) — animasi, dark mode, semua section
- Form laporan 3-step (`/laporan`) — submit masih simulasi dummy
- Dashboard admin (`/admin/dashboard`) — data masih hardcoded
- Login admin (`/admin/login`) + route protection
- Dark mode di semua halaman (ThemeProvider + ThemeToggle)
- `.gitignore` lengkap + CLAUDE.md

### ❌ Belum Selesai
- Mobile optimization: `app/laporan/page.tsx` dan `app/page.tsx`
- Flask/FastAPI `/predict` endpoint (dikerjakan teman)
- Integrasi FE ↔ backend (fetch ke `/predict` dan `/laporan`)
- Koneksi Supabase di backend
- Data real dari Supabase di dashboard (masih dummy)

---

## 9. KNOWN ISSUES

1. **Tailwind v4** — custom colors didefinisikan via `@theme { }` di `globals.css`, bukan `tailwind.config.ts`. Jangan tambahkan warna di config.
2. **Dashboard data dummy** — semua data laporan di dashboard hardcoded, belum fetch dari Supabase.
3. **handleSubmit simulasi** — `app/laporan/page.tsx` masih pakai `setTimeout` 2000ms, belum terhubung ke API.
4. **Model artifacts gitignored** — regenerate dari `notebooks/02_modeling.ipynb` jika belum ada.

---

## 10. KONVENSI KODE

- **Bahasa Indonesia** di variable name, komentar, field DB, dan UI text
- **Urgensi:** selalu `Tinggi` / `Sedang` / `Rendah` (kapital di awal) — match PostgreSQL ENUM
- **Next.js 16.2** App Router — cek `frontend/AGENTS.md` untuk referensi API terbaru sebelum edit frontend
- **`.env` gitignored** — jangan pernah commit. File `.env` di root hanya untuk dev lokal (credentials placeholder)
- **Model artifacts gitignored** — share via MLflow atau external storage