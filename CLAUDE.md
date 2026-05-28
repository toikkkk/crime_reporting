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
- **SHAP** (`shap==0.46.0`) — TreeExplainer di-init sekali saat server start untuk `/api/explain`
- **File model:** `model_final.pkl`, `vectorizer.pkl`, `model_metadata.json`  
  tersimpan di `backend/ml/models/` (di repo — bisa langsung dipakai)
- **Input:** teks deskripsi | **Output:** `risk_score` (float 0–100) → threshold ke kategori

---

## 4. ARSITEKTUR

### Backend (`backend/app/`)

`main.py` adalah entry point aktif — semua logika ada di sini secara monolitik. Folder `api/`, `db/schemas/`, `services/` masih kosong (scaffold untuk pengembangan selanjutnya).

```
app/
├── main.py          # Entry point. Semua endpoint aktif ada di sini (monolitik).
│                    # Load env via os.getenv() — TIDAK pakai config.py.
│                    # Supabase client dari db/client.py (sudah dipakai).
├── core/config.py   # Settings via pydantic-settings.
├── db/client.py     # Supabase client singleton — dipakai main.py.
├── ml/
│   └── preprocessor.py   # Pipeline inference + post-processing + SHAP explainer.
│                          # MODEL_DIR → backend/ml/models/ (dua level ke atas dari sini)
├── api/             # Scaffold kosong
├── schemas/         # Scaffold kosong
└── services/        # Scaffold kosong
```

Model artifacts ada di `backend/ml/models/` (bukan `backend/app/ml/models/`).
Notebook yang menghasilkannya: `notebooks/04_hybrid_risk_scoring.ipynb`.

### Frontend (`frontend/app/`)
```
app/
├── page.tsx                    # Landing page publik
├── layout.tsx                  # Root layout (ThemeProvider ada di sini — JANGAN duplikat)
├── globals.css                 # Global styles + Tailwind @theme
├── laporan/
│   ├── page.tsx                # Wrapper — hanya re-export laporan_page.tsx
│   └── laporan_page.tsx        # Form 3-step ('use client').
│                               # handleSubmit() POST ke NEXT_PUBLIC_API_URL/api/laporan
│                               # ticket_id dari response backend.
├── admin/
│   ├── login/page.tsx          # Login admin
│   └── dashboard/
│       ├── page.tsx            # Dashboard admin — fetch real dari GET /api/laporan.
│       │                       # Modal membuka POST /api/explain (SHAP + tipe kejahatan).
│       │                       # Polling otomatis setiap 10 detik.
│       └── dashboard.css       # CSS khusus dashboard + tipe-badge + shap chart styles
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
  → bersihkan_teks()        # lowercase + regex [^a-z\s] + Sastrawi stem
  → vectorizer.transform()  # TF-IDF (3000)
  → hitung_urgensi()        # 7 urgency scores (log1p word count)
  → hstack()                # Feature Union (3007)
  → model_final.predict()   # GBR → clip [0, 100]
  → POST-PROCESSING LAYER:
      • SAFE_CONTEXT suppressor  # skor ×0.5 jika ada kata: mainan, toko, beli, dll.
      • Keyword floor rule       # _kw_match() — word-exact (bukan substring!)
          critical_hit ≥ 3 → floor Tinggi
          critical_hit ≥ 2 atau total_hit ≥ 3 → floor Sedang
      • PUBLIC_RISK_SIGNALS      # balap liar, tawuran, gerombolan → floor Sedang
      • PROPERTY_CRIME_SIGNALS   # dibobol, motor hilang, dicopet → floor Sedang
      • ACTIVE_SIGNALS booster   # ada korban, sedang berlangsung → paksa Tinggi
  → threshold               # >=67 Tinggi | >=34 Sedang | <34 Rendah
```

> **PENTING — `_kw_match()`:** Semua pengecekan keyword di floor rule dan keywords_detected
> harus lewat `_kw_match(kw, teks_clean, words_set)`, BUKAN `kw in teks_clean`.
> Alasan: `"api" in "tapi"` = `True` di Python → false positive fatal.
> Single-word keyword → cek di `words_set`; multi-word → substring di `teks_clean`.

### Response shape dari `jalankan_pipeline_ml()`
```python
{
    "teks_bersih":      str,       # teks setelah clean + stem
    "risk_score":       float,     # 0.0 – 100.0 (setelah post-processing)
    "kategori":         str,       # "Tinggi" | "Sedang" | "Rendah"
    "keywords_detected": list[str] # kata-kata dari URGENCY_SIGNALS yang terdeteksi
}
```

### Response shape dari `compute_shap_explanation()`
```python
{
    "tipe_kejahatan": str,          # "Perampokan / Pencurian" | "Kekerasan Fisik" | dll.
    "shap_features":  list[dict],   # top 8 fitur by |SHAP value|
    "base_value":     float         # expected_value model
}
```

### Klasifikasi Tipe Kejahatan (`tentukan_tipe_kejahatan`)
Score-based (bukan first-match). Kategori dengan weighted urgency score tertinggi menang:
```
Pembunuhan / Penganiayaan  → skor_kematian         × 1.5
Senjata Berbahaya          → skor_senjata           × 1.5
Kekerasan Fisik            → skor_kekerasan_fisik   × 1.2
Perampokan / Pencurian     → skor_perampasan_paksa
                             + skor_harta            × 1.3
Pidana Berat               → skor_pidana_berat      × 1.0
Kriminalitas Ringan        → skor_ringan             × 1.0
```

---

## 7. API AKTIF

### Endpoint yang sudah berjalan
```
GET  /                              → health check
POST /api/laporan                   → terima laporan, jalankan ML, simpan ke Supabase
GET  /api/laporan                   → list semua laporan + stats (total, tinggi, aktif, selesai)
GET  /api/laporan/{ticket_id}       → detail satu laporan
PATCH /api/laporan/{ticket_id}/status → update status laporan
POST /api/laporan/{ticket_id}/foto  → upload foto bukti ke Supabase Storage
GET  /api/laporan/{ticket_id}/foto  → list foto bukti
POST /api/explain                   → SHAP values + tipe kejahatan (on-demand, tidak disimpan ke DB)
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

**1. ~~IP hardcoded di frontend~~** — SELESAI. Sudah pakai `process.env.NEXT_PUBLIC_API_URL`.

**2. ~~Dashboard hardcoded~~** — SELESAI. Fetch real dari `GET /api/laporan`, polling 10 detik.

**3. Duplikasi Supabase client di `main.py`** — sudah diperbaiki, pakai singleton dari `db/client.py`.

**4. `config.py` tidak dipakai `main.py`** — main.py masih load `.env` via `os.getenv()` langsung.

**5. SHAP tidak disimpan ke DB** — `POST /api/explain` dihitung ulang setiap kali modal dibuka.
Jika performa jadi isu, cache hasil di Supabase kolom `shap_result` (jsonb).

---

## 8. KONVENSI KODE

- **Bahasa Indonesia** di variable name, komentar, field DB, dan UI text
- **Urgensi:** selalu `Tinggi` / `Sedang` / `Rendah` (kapital di awal) — match PostgreSQL ENUM
- **`.env` gitignored** — jangan pernah commit
- **Model artifacts** — ada di repo (`backend/ml/models/`), tidak perlu regenerate
- **Keyword matching di preprocessor** — selalu pakai `_kw_match()`, BUKAN `kw in teks_clean`

---

## 9. DEMO INPUTS (3 KASUS UJI)

Tiga inputan yang dijamin benar untuk demo/presentasi:

### TINGGI — Perampokan Bersenjata
**Judul:** Perampokan Bersenjata Disertai Penganiayaan  
**Lokasi:** Jl. Raya Ciputat No. 88, Tangerang Selatan  
**Deskripsi:**
> Pak polisi tolong segera datang ke Indomaret dekat rumah saya, ada perampokan bersenjata. Dua pelaku pakai penutup muka masuk dan merampas semua uang dari kasir dengan ancaman celurit. Penjaga toko dipukul dan dihajar sampai luka berdarah di kepala, kondisinya sekarang kritis tidak sadarkan diri. Ada korban luka berat, tolong segera datang.

*Trigger: ACTIVE_SIGNALS ("ada korban", "tolong segera datang") → paksa TINGGI. Tipe: Perampokan / Pencurian.*

### SEDANG — Pencurian Kendaraan
**Judul:** Pencurian Motor di Parkiran Masjid  
**Lokasi:** Masjid Al-Ikhlas, Jl. Proklamasi No. 5, Depok  
**Deskripsi:**
> Selamat siang pak, mau lapor kehilangan motor saya. Tadi waktu sholat Jumat sekitar 30 menit, motor Vario 125 hitam plat B 3421 XYZ saya tinggal di parkiran masjid. Setelah sholat selesai motor hilang, kunci stang dibobol paksa oleh pelaku. Motor itu satu-satunya kendaraan saya untuk bekerja setiap hari. Mohon dibantu dilacak.

*Trigger: PROPERTY_CRIME_SIGNALS ("motor hilang", "dibobol") → floor SEDANG. Tipe: Perampokan / Pencurian.*

### RENDAH — Gangguan Ketertiban
**Judul:** Gangguan Ketertiban Lingkungan Oleh Tetangga  
**Lokasi:** Perumahan Griya Asri Blok C No. 12, Bekasi Utara  
**Deskripsi:**
> Saya ingin melaporkan gangguan ketertiban di lingkungan perumahan kami. Hampir setiap malam ada keributan dari rumah tetangga sebelah, teriak-teriak dan benda-benda dilempar hingga terdengar ke luar. Sudah berkali-kali warga sekitar menegur namun tidak ada perubahan. Mohon ada penertiban atau mediasi dari pihak berwajib agar suasana lingkungan kembali kondusif.

*Tidak ada signal apapun → model raw score rendah → RENDAH. Tipe: Kriminalitas Ringan. Kata "namun" dipakai (bukan "tapi") agar "api" tidak muncul sebagai false positive.*
