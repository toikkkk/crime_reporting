# Alur Kerja Sistem SIPEDULI
## Sistem Pelaporan Kejahatan Terpadu Berbasis AI

---

## 1. Pengumpulan Data (Data Collection)

- **Sumber:** Scraping berita kriminal dari portal berita online Indonesia
- **Jumlah:** 2.413 baris data laporan kejahatan
- **Format:** CSV dengan kolom teks deskripsi kejahatan
- **Tools:** Python (requests, BeautifulSoup)

---

## 2. Pra-Pemrosesan Data (Preprocessing)

- **Case folding:** Teks diubah ke huruf kecil
- **Cleaning:** Hapus karakter non-alfabet menggunakan regex
- **Stemming:** Menggunakan library **Sastrawi** untuk stemming Bahasa Indonesia
- **Tokenisasi:** Teks dipecah menjadi token kata
- **Hasil:** Teks bersih siap untuk ekstraksi fitur

---

## 3. Pipeline Machine Learning

### Tahap 1 — Pelabelan Otomatis (Unsupervised)

Label urgensi dibuat secara otomatis tanpa anotasi manual:

1. Buat **7 urgency-signal features** (skor kata per dokumen):
   - `skor_kematian`, `skor_senjata`, `skor_kekerasan_fisik`
   - `skor_perampasan_paksa`, `skor_pidana_berat`, `skor_harta`, `skor_ringan`
2. **StandardScaler** → normalisasi fitur
3. **KMeans (k=3)** → clustering ke 3 kelompok urgensi
4. Identifikasi *Critical Centroid* berdasarkan bobot domain
5. Hitung **Euclidean Distance** setiap dokumen ke Critical Centroid
6. Normalisasi Min-Max inverse → **risk_score** [0–100]

### Tahap 2 — Regresi Supervised

| Komponen | Detail |
|----------|--------|
| Fitur input | TF-IDF (3.000 fitur, n-gram 1–3) + 7 urgency scores = **3.007 fitur** |
| Model | **GradientBoostingRegressor** |
| Optimasi | Optuna (30 trials, minimize RMSE) |
| Hasil | R² = 0.91 · MAE = 0.79 · RMSE = 2.59 |
| Output | `risk_score` float [0–100] |

### Tahap 3 — Post-Processing & Threshold

```
risk_score ≥ 67  →  Tinggi
risk_score ≥ 34  →  Sedang
risk_score < 34  →  Rendah
```

Aturan tambahan:
- **SAFE_CONTEXT suppressor:** skor dikali 0.5 jika konteks tidak darurat
- **Keyword floor rule:** kata kritis terdeteksi → paksa naik kategori
- **ACTIVE_SIGNALS booster:** "ada korban", "tolong segera" → paksa Tinggi

---

## 4. Arsitektur Sistem

```
[Warga]
   │
   ▼
[Frontend — Next.js 16.2]
   │  Form 3-step laporan
   │  POST /api/laporan
   │
   ▼
[Backend — FastAPI]
   │  Jalankan pipeline ML
   │  Hitung risk_score & kategori
   │
   ▼
[Database — Supabase (PostgreSQL)]
   │  Simpan laporan + hasil AI
   │
   ▼
[Dashboard Admin]
   │  Kelola status laporan
   │  Peta sebaran (Leaflet)
   │  Analisis SHAP per laporan
```

---

## 5. Tabel Teknologi

| Layer | Teknologi |
|-------|-----------|
| Frontend | Next.js 16.2, TypeScript, TailwindCSS v4 |
| Backend | FastAPI 0.115, Python 3.11, Uvicorn |
| Database | Supabase (PostgreSQL) via supabase-py |
| ML | scikit-learn, SHAP, Sastrawi, Optuna |
| Experiment Tracking | MLflow |
| Containerisasi | Docker, Docker Compose |
| Deployment | Railway (backend + frontend) |
| Domain | sipeduli.online (Domainnesia) |

---

## 6. Alur Pelaporan Warga

```
1. Warga isi form (Judul, Lokasi, Deskripsi, Identitas)
2. Submit → POST /api/laporan ke backend
3. Backend jalankan ML pipeline
4. Hasil: risk_score, kategori, keywords_detected
5. Data disimpan ke Supabase
6. Warga terima Ticket ID (format: CRM-YYYY-NNNN)
7. Warga bisa cek status via Ticket ID di halaman publik
```

---

## 7. Alur Pengelolaan Admin

```
1. Admin login ke dashboard
2. Dashboard fetch semua laporan (polling 10 detik)
3. Admin lihat peta sebaran kejahatan (Leaflet Map)
4. Admin buka detail laporan
5. Admin update status: Diterima → Dianalisis → Selesai
6. Admin tambah catatan petugas
7. Catatan tampil di halaman cek status publik
```

---

## 8. Deployment

| Service | Platform | URL |
|---------|----------|-----|
| Frontend | Railway (GitHub auto-deploy) | www.sipeduli.online |
| Backend | Railway (GitHub auto-deploy) | crime-backend-production.up.railway.app |
| Database | Supabase Cloud | — |
| DNS | Domainnesia → ns1/ns2.domainesia.net | sipeduli.online |

**CI/CD:** Setiap push ke branch `main` di GitHub otomatis trigger rebuild dan redeploy di Railway.

---

## 9. Penjelasan Model AI (SHAP)

- Endpoint `POST /api/explain` menghitung **SHAP values** on-demand
- Menjelaskan kontribusi setiap kata terhadap prediksi skor
- Output: top 8 fitur berpengaruh + **tipe kejahatan** (score-based classification)
- Tipe kejahatan: Pembunuhan, Senjata Berbahaya, Kekerasan Fisik, Perampokan, Pidana Berat, Kriminalitas Ringan
