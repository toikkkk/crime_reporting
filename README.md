# SIPEDULI — Sistem Pelaporan Kejahatan Terpadu

Portal pelaporan kejahatan berbasis web dengan AI risk scoring otomatis. Masyarakat mengisi form laporan → model ML menilai urgensi → polisi mengelola via dashboard admin.

---

## Prasyarat

Pastikan sudah terinstal di komputer:

| Software | Versi minimum | Cek versi |
|---|---|---|
| Python | 3.11 | `python --version` |
| Node.js | 18+ | `node --version` |
| npm | 9+ | `npm --version` |
| Git | — | `git --version` |

---

## 1. Clone Repository

```bash
git clone https://github.com/toikkkk/crime_reporting.git
cd crime_reporting
```

---

## 2. Konfigurasi Environment

File `.env` sudah ada di repository — tidak perlu konfigurasi apapun, langsung lanjut ke langkah berikutnya.

---

## 3. Setup Backend (Python / FastAPI)

### 3a. Buat virtual environment

```bash
# Windows (PowerShell)
cd backend
python -m venv venv311
.\venv311\Scripts\activate
```

### 3b. Install dependensi

```bash
pip install -r requirements.txt
```

### 3c. Jalankan backend

```bash
# Dari dalam folder backend/ (dengan venv aktif)
uvicorn app.main:app --reload --port 8000
```

Backend berjalan di: `http://localhost:8000`  
Dokumentasi API: `http://localhost:8000/docs`

---

## 4. Setup Frontend (Next.js)

Buka terminal baru (biarkan backend tetap jalan):

```bash
cd frontend
npm install
npm run dev
```

Frontend berjalan di: `http://localhost:3000`

---

## 5. Akses Aplikasi

| Halaman | URL |
|---|---|
| Landing page | `http://localhost:3000` |
| Form laporan | `http://localhost:3000/laporan` |
| Dashboard admin | `http://localhost:3000/admin/dashboard` |
| API docs | `http://localhost:8000/docs` |

### Login Admin

Masuk ke `http://localhost:3000/admin/login` menggunakan akun yang sudah terdaftar di Supabase.

---

## 6. Struktur Project

```
crime_reporting/
├── backend/               # FastAPI + ML pipeline
│   ├── app/
│   │   ├── main.py        # Entry point API
│   │   ├── ml/
│   │   │   └── preprocessor.py   # Inference pipeline
│   │   └── db/
│   │       └── client.py         # Supabase client
│   ├── ml/
│   │   └── models/        # model_final.pkl, vectorizer.pkl, model_metadata.json
│   ├── requirements.txt
│   └── .env               # Kredensial Supabase (sudah ada di repo)
├── frontend/              # Next.js 16 App Router
│   ├── app/
│   │   ├── page.tsx           # Landing page
│   │   ├── laporan/           # Form pelaporan
│   │   └── admin/dashboard/   # Dashboard admin
│   └── public/
│       └── logo.png       # Logo SIPEDULI
├── notebooks/
│   └── 04_hybrid_risk_scoring.ipynb   # Training model ML
└── scripts/
    └── init.sql           # Schema database
```

---

## 7. Troubleshooting

### `ModuleNotFoundError: No module named 'app'`
Pastikan menjalankan uvicorn dari **dalam folder `backend/`**, bukan dari root project.

### Frontend tidak bisa konek ke backend
Pastikan backend sudah jalan di port 8000. Cek `NEXT_PUBLIC_API_URL` di environment frontend jika deploy ke server.

### Error saat `pip install`
Pastikan Python yang aktif adalah versi 3.11:
```bash
python --version   # harus 3.11.x
```

---

## 8. Tech Stack

- **Frontend:** Next.js 16.2, TypeScript, TailwindCSS v4
- **Backend:** FastAPI 0.115, Python 3.11
- **Database:** Supabase (PostgreSQL)
- **ML:** GradientBoostingRegressor, TF-IDF, Sastrawi stemmer
- **Storage:** Supabase Storage (foto bukti)
