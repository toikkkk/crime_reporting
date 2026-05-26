# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Baca file ini sepenuhnya sebelum menyentuh kode apapun.

---

## 1. PROJECT OVERVIEW

**SIPEDULI** — Sistem Pelaporan Kejahatan Terpadu  
**Jenis:** Project UAS (Machine Learning + Web Service + Data Mining)  
**GitHub:** https://github.com/toikkkk/crime_reporting.git

**Konsep:** Portal pelaporan kejahatan berbasis web. Masyarakat isi form → ML scoring urgensi otomatis → Polisi kelola via dashboard.

```
User isi form (3 step) → POST /api/laporan → jalankan_pipeline_ml() →
GBR regression → skor 0-100 → kategori Tinggi/Sedang/Rendah →
simpan ke Supabase → tampil di dashboard admin
```

---

## 2. COMMANDS

### Full Stack (Docker)
```bash
docker-compose up -d
docker-compose logs backend
```

### Backend (local dev)
```bash
# Dari root project (Windows):
.\backend\venv311\Scripts\activate
uvicorn app.main:app --reload --port 8000 --app-dir backend
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

> **PENTING — Next.js 16.2:** Ada breaking changes dari training data LLM.
> Cek `node_modules/next/dist/docs/` sebelum menulis kode frontend.
> Jangan asumsikan konvensi Next.js lama masih berlaku.

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

### Env vars kritis (`.env` di root project)
```
SUPABASE_URL / SUPABASE_KEY
DATABASE_URL                           # PostgreSQL connection string (untuk SQLAlchemy)
SECRET_KEY
POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB   # Docker DB
NEXT_PUBLIC_API_URL=http://localhost:8000          # dipakai frontend Docker image
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
- **Supabase** (PostgreSQL) sebagai database — diakses via `supabase-py` client, bukan SQLAlchemy
- **SQLAlchemy 2.0** + **Alembic** ada di requirements tapi belum dipakai di `main.py`
- **python-jose** + **passlib[bcrypt]** untuk auth (belum diimplementasikan)

### ML
- **Pipeline Hybrid** — Feature Union (TF-IDF 3000 + 7 urgency scores) → GradientBoostingRegressor
- **Sastrawi** untuk Indonesian stemming
- **File model:** `model_final.pkl`, `vectorizer.pkl`, `model_metadata.json`  
  tersimpan di `backend/ml/models/` (gitignored — regenerate dari `notebooks/04_hybrid_risk_scoring.ipynb`)
- **Input:** teks deskripsi | **Output:** `risk_score` (float 0–100) → threshold ke kategori

---

## 4. ARSITEKTUR

### Backend (`backend/app/`)

`main.py` adalah entry point aktif — semua logika ada di sini secara monolitik. Folder `api/`, `db/schemas/`, `services/` masih kosong (scaffold untuk pengembangan selanjutnya).

```
app/
├── main.py          # Entry point. Endpoint aktif: GET /, POST /api/laporan.
│                    # Load env langsung via os.getenv() — TIDAK pakai config.py.
│                    # Inisialisasi supabase client di level modul DAN di dalam handler
│                    # (ada duplikasi — lihat catatan di bawah).
├── core/config.py   # Settings via pydantic-settings. Diimport oleh db/client.py,
│                    # tapi TIDAK dipakai main.py (main.py pakai os.getenv langsung).
├── db/client.py     # Supabase client singleton via config.py — belum dipakai main.py.
├── ml/
│   └── preprocessor.py   # Pipeline inference production (load model saat import).
│                          # MODEL_DIR → backend/ml/models/ (dua level ke atas dari sini)
├── api/             # Scaffold kosong
├── schemas/         # Scaffold kosong
└── services/        # Scaffold kosong
```

Model artifacts ada di `backend/ml/models/` (bukan `backend/app/ml/models/`).
Notebook yang menghasilkannya: `notebooks/04_hybrid_risk_scoring.ipynb`.

> **Catatan duplikasi di main.py:** Supabase client dibuat dua kali — sekali di level modul
> (`supabase = create_client(...)`) dan sekali lagi di dalam handler `buat_laporan_baru()`.
> Client di dalam handler yang benar-benar dipakai untuk `.insert()`.

### Frontend (`frontend/app/`)
```
app/
├── page.tsx                    # Landing page publik
├── layout.tsx                  # Root layout (ThemeProvider ada di sini — JANGAN duplikat)
├── globals.css                 # Global styles + Tailwind @theme
├── laporan/
│   ├── page.tsx                # Wrapper — hanya re-export laporan_page.tsx
│   └── laporan_page.tsx        # Form 3-step ('use client').
│                               # handleSubmit() sudah terhubung ke backend:
│                               # POST ke http://192.168.1.97:8000/api/laporan (IP hardcoded!)
│                               # generateTicketId() sudah diganti — ticket_id dari response backend.
├── admin/
│   ├── login/page.tsx          # Login admin
│   └── dashboard/
│       ├── page.tsx            # Dashboard admin — REPORTS & NOTIFICATIONS masih hardcoded
│       └── dashboard.css       # CSS khusus dashboard
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

> **Perhatian:** Skema `laporan` di `init.sql` menggunakan kolom `judul_laporan`, `nama_pelapor`, dll.
> Tapi `main.py` insert dengan key `judul`, `nama_pelapor`, `kontak_pelapor`, `prediksi_urgensi` —
> pastikan kolom di Supabase sudah disesuaikan dengan yang dipakai `main.py`.

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
- 2.413 baris data real dari scraping berita kriminal (SMOTE hanya dipakai di notebook lama)
- Label lama (dari keyword scraping) di-drop — label baru dihasilkan oleh clustering unsupervised

### Pipeline (notebook: `notebooks/04_hybrid_risk_scoring.ipynb`)

**Tahap 1 — Unsupervised Labeling:**
1. Buat 7 urgency-signal features (normalized word count per dokumen):
   `skor_kematian`, `skor_senjata`, `skor_kekerasan_fisik`, `skor_perampasan_paksa`,
   `skor_pidana_berat`, `skor_harta`, `skor_ringan`
2. StandardScaler → KMeans(k=3, n_init=30)
3. Identifikasi Critical Centroid (Cluster 0) via bobot: kematian×3 + senjata×2 + pidana×2 + kekerasan×1.5
4. Euclidean distance tiap dokumen ke Critical Centroid → normalisasi Min-Max inverse → `risk_score` [0–100]

**Tahap 2 — Supervised Regression:**
1. Feature Union: TF-IDF(3000 features, ngram 1–3) + 7 urgency scores → `(n, 3007)` matrix
2. GradientBoostingRegressor (Optuna 30 trials, minimize RMSE)
3. Hasil: R² test=0.91, MAE=0.79, RMSE=2.59

### Inference Production (`backend/app/ml/preprocessor.py`)
```
teks_input
  → bersihkan_teks()     # lowercase + regex [^a-z\s] + Sastrawi stem
  → vectorizer.transform()  # TF-IDF (3000)
  → hitung_urgensi()        # 7 urgency scores
  → hstack()                # Feature Union (3007)
  → model_final.predict()   # GBR → clip [0, 100]
  → threshold               # >=67 Tinggi | >=34 Sedang | <34 Rendah
```

### Response shape dari `jalankan_pipeline_ml()`
```python
{
    "teks_bersih": str,      # teks setelah clean + stem
    "risk_score": float,     # 0.0 – 100.0
    "kategori": str          # "Tinggi" | "Sedang" | "Rendah"
}
```

---

## 7. API AKTIF

### Endpoint yang sudah berjalan
```
GET  /              → health check sederhana
POST /api/laporan   → terima laporan, jalankan ML, simpan ke Supabase
```

### Request `POST /api/laporan`
```json
{
  "judul": "string",
  "deskripsi": "string",
  "lokasi": "string",
  "nama_pelapor": "string",
  "kontak_pelapor": "string"
}
```

### Response sukses
```json
{
  "status": "success",
  "ticket_id": "LAP-XXXXXXXX",
  "data": [...],
  "analisis": {
    "teks_bersih": "...",
    "risk_score": 72.5,
    "kategori": "Tinggi"
  }
}
```

> **Catatan:** `ticket_id` di backend format `LAP-{uuid[:8].upper()}`, bukan `CRM-YYYY-NNNN`
> dari DB trigger. DB trigger di `init.sql` menghasilkan format berbeda — pastikan konsisten.

### Pending / Hutang Teknis

**1. IP hardcoded di frontend** — `laporan_page.tsx:696` pakai `http://192.168.1.97:8000/api/laporan`.
Ganti dengan env var: `process.env.NEXT_PUBLIC_API_URL + '/api/laporan'`.

**2. `app/admin/dashboard/page.tsx`** — array `REPORTS` dan `NOTIFICATIONS` masih hardcoded.
Implementasikan `GET /api/laporan` dan sambungkan.

**3. Duplikasi Supabase client di `main.py`** — client dibuat ulang di dalam handler.
Seharusnya pakai singleton dari `db/client.py`.

**4. `config.py` tidak dipakai `main.py`** — main.py load `.env` manual via `os.getenv()`.
Refactor untuk pakai `settings` dari `core/config.py`.

**5. Endpoint-endpoint di CLAUDE.md lama** (`POST /predict`, `GET /laporan`, dll) belum ada —
masih scaffold kosong di `api/`.

---

## 8. KONVENSI KODE

- **Bahasa Indonesia** di variable name, komentar, field DB, dan UI text
- **Urgensi:** selalu `Tinggi` / `Sedang` / `Rendah` (kapital di awal) — match PostgreSQL ENUM
- **`.env` gitignored** — jangan pernah commit
- **Model artifacts gitignored** — regenerate dari `notebooks/02_modeling.ipynb`
