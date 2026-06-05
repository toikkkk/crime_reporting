# Alur Kerja Sistem SIPEDULI
## Sistem Pelaporan Kejahatan Terpadu Berbasis AI

---

## 1. Pengumpulan Data (Data Collection)

- **Sumber:** Scraping berita kriminal dari portal berita online Indonesia
- **Jumlah:** 2.413 baris data real + 600 baris synthetic user reports = **3.013 baris total**
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

Label urgensi dibuat secara otomatis tanpa anotasi manual menggunakan **2.413 data real** saja:

1. Buat **7 urgency-signal features** (count / total_words per dokumen):
   - `skor_kematian`, `skor_senjata`, `skor_kekerasan_fisik`
   - `skor_perampasan_paksa`, `skor_pidana_berat`, `skor_harta`, `skor_ringan`
2. **StandardScaler** → normalisasi fitur
3. **KMeans (k=3, n_init=30)** → clustering ke 3 kelompok urgensi
   - Silhouette Score: **0.2278**
   - Critical Centroid: Cluster 0 (bobot kematian×3 + senjata×2 + pidana×2 + kekerasan×1.5)
4. Hitung **Euclidean Distance** setiap dokumen ke Critical Centroid
5. Normalisasi Min-Max inverse → **risk_score** [0–100]

### Tahap 1b — Penggabungan Data Sintetis

600 laporan user simulasi (balanced: 200 Tinggi/Sedang/Rendah) digabungkan ke supervised training untuk menutup distribusi shift antara teks berita dan laporan warga.

### Tahap 2 — Regresi Supervised

| Komponen | Detail |
|----------|--------|
| Fitur input | TF-IDF (3.000 fitur, n-gram 1–3) + 7 urgency scores = **3.007 fitur** |
| Seleksi model | **PyCaret** (komparasi semua algoritma regresi) |
| Pemenang | **ExtraTreesRegressor** |
| Optimasi | Optuna (30 trials, minimize RMSE) · Best CV RMSE: 3.6956 |
| Hasil | R² = **0.9579** · MAE = **2.13** · RMSE = **4.21** |
| Output | `risk_score` float [0–100] |

### Tahap 3 — Post-Processing & Threshold

```
risk_score ≥ 67  →  Tinggi
risk_score ≥ 34  →  Sedang
risk_score < 34  →  Rendah
```

Aturan tambahan:
- **SAFE_CONTEXT suppressor:** skor dikali 0.5 jika konteks tidak darurat (beli, toko, mainan)
- **ADMIN_SIGNALS cap:** laporan kehilangan dokumen administratif → cap Rendah
- **Keyword floor rule:** kata kritis ≥3 → floor Tinggi; ≥2 atau total ≥3 → floor Sedang
- **PUBLIC_RISK_SIGNALS:** balap liar, tawuran, gerombolan → floor Sedang
- **PROPERTY_CRIME_SIGNALS:** dibobol, motor hilang, dicopet → floor Sedang
- **ACTIVE_SIGNALS booster:** "ada korban", "tolong segera" → paksa Tinggi

> **Penting:** Semua pengecekan keyword menggunakan `_kw_match()` (word-exact untuk kata tunggal, substring untuk frasa) — mencegah false positive seperti "api" terdeteksi dalam "tapi".

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
[Backend — FastAPI 0.115]
   │  Jalankan pipeline ML (preprocessor.py)
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
   │  Analisis SHAP per laporan (POST /api/explain)
```

---

## 5. Tabel Teknologi

| Layer | Teknologi |
|-------|-----------|
| Frontend | Next.js 16.2, TypeScript, TailwindCSS v4 |
| Backend | FastAPI 0.115, Python 3.11, Uvicorn |
| Database | Supabase (PostgreSQL) via supabase-py |
| ML | scikit-learn, SHAP, Sastrawi, Optuna, PyCaret |
| Experiment Tracking | MLflow |
| Containerisasi | Docker, Docker Compose |
| Deployment | Railway (backend + frontend) |
| Domain | sipeduli.online (Domainnesia) |

---

## 6. Alur Pelaporan Warga

```
1. Warga isi form (Judul, Lokasi, Deskripsi, Identitas)
2. Submit → POST /api/laporan ke backend
3. Backend jalankan ML pipeline (preprocessor.py)
4. Hasil: risk_score, kategori, keywords_detected
5. Data disimpan ke Supabase
6. Warga terima Ticket ID (format: LAP-XXXXXXXX)
7. Warga bisa cek status via Ticket ID di halaman publik
```

---

## 7. Alur Pengelolaan Admin

```
1. Admin login ke dashboard
2. Dashboard fetch semua laporan (polling 10 detik)
3. Admin lihat peta sebaran kejahatan (Leaflet Map)
4. Admin buka detail laporan → modal tampil
5. Modal trigger POST /api/explain → SHAP analysis + tipe kejahatan
6. Admin update status: Diterima → Dianalisis → Dalam Penyelidikan → Selesai
7. Admin tambah catatan petugas
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

> **Catatan:** Model IndoBERT (notebook 05) hanya untuk perbandingan akademis — tidak di-deploy ke Railway karena keterbatasan memori (model 400MB+, R²=0.5 vs ExtraTrees R²=0.9579).

---

## 9. Penjelasan Model AI (SHAP)

- Endpoint `POST /api/explain` menghitung **SHAP values** on-demand (tidak disimpan ke DB)
- Menggunakan `shap.TreeExplainer` — kompatibel dengan ExtraTreesRegressor
- Menjelaskan kontribusi setiap token terhadap prediksi risk_score
- Output: top 8 fitur berpengaruh (by |SHAP value|) + **tipe kejahatan**
- Tipe kejahatan ditentukan dua tahap: keyword-based (prioritas) → fallback urgency score
- 12 kategori tipe: Pembunuhan, Perampokan Bersenjata, Tawuran, Kekerasan Fisik, Senjata Berbahaya, Pencurian Kendaraan, Pencurian/Pencopetan, Balap Liar, Penipuan/Siber, Vandalisme, Sengketa Perdata, Kehilangan/Administrasi

---

## 10. Artifact Model

| File | Lokasi | Isi |
|------|--------|-----|
| `model_final.pkl` | `backend/ml/models/` | ExtraTreesRegressor terlatih |
| `vectorizer.pkl` | `backend/ml/models/` | TF-IDF Vectorizer (3.000 token) |
| `model_metadata.json` | `backend/ml/models/` | Metrik evaluasi + urgency_signals + threshold |

> Model artifacts di-commit ke repo (tidak di `.gitignore`) agar Railway bisa langsung load tanpa proses training ulang saat deploy.
