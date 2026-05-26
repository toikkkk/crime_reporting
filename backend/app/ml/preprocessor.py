import re
import os
import joblib
import json
import numpy as np
import scipy.sparse as sp
from scipy.sparse import hstack
from Sastrawi.Stemmer.StemmerFactory import StemmerFactory

# 1. Inisialisasi Stemmer sekali saja di awal
factory = StemmerFactory()
stemmer = factory.create_stemmer()

# 2. Setup Path ke folder models
# preprocessor.py ada di backend/app/ml/ → naik 2 level ke backend/ → masuk ml/models/
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "..", "..", "ml", "models")

# 3. Load Model & Metadata
# Kita load di luar fungsi agar performa API cepat (cuma sekali load saat server start)
try:
    model_final = joblib.load(os.path.join(MODEL_DIR, 'model_final.pkl'))
    vectorizer = joblib.load(os.path.join(MODEL_DIR, 'vectorizer.pkl'))
    
    with open(os.path.join(MODEL_DIR, 'model_metadata.json'), 'r') as f:
        metadata = json.load(f)
        
    URGENCY_SIGNALS = metadata['urgency_signals']
    FEATURE_COLS = list(URGENCY_SIGNALS.keys())
    # Threshold dikalibrasi dari notebook — load dari metadata, jangan hardcode
    THR_TINGGI = metadata.get('threshold_tinggi', 67.0)
    THR_SEDANG = metadata.get('threshold_sedang', 34.0)
except Exception as e:
    raise FileNotFoundError(f"Gagal load model ML! Pastikan file ada di {MODEL_DIR}. Error: {e}")

# 4. Fungsi-fungsi utama untuk dipanggil di main.py
def bersihkan_teks(teks: str) -> str:
    """Membersihkan teks: lowercase, hapus simbol, dan stemming Sastrawi."""
    teks = teks.lower()
    teks = re.sub(r'[^a-z\s]', ' ', teks)
    return stemmer.stem(teks)

def hitung_urgensi(teks_clean: str) -> list:
    """Menghitung 7 skor urgensi berdasarkan kamus (log1p — length-invariant)."""
    words = teks_clean.split()
    return [[float(np.log1p(sum(words.count(kw) for kw in URGENCY_SIGNALS[fitur]))) for fitur in FEATURE_COLS]]

def jalankan_pipeline_ml(teks_input: str):
    """Fungsi utama untuk menjalankan seluruh proses ML."""
    # A. Preprocessing
    teks_clean = bersihkan_teks(teks_input)
    
    # B. Feature Extraction & Union
    X_tfidf = vectorizer.transform([teks_clean])
    X_urgensi = hitung_urgensi(teks_clean)
    X_final = hstack([X_tfidf, sp.csr_matrix(X_urgensi)])
    
    # C. Prediksi
    skor_raw = model_final.predict(X_final)[0]
    skor_final = float(np.clip(skor_raw, 0.0, 100.0))
    
    # D. Kategori awal dari model
    kategori = 'Tinggi' if skor_final >= THR_TINGGI else 'Sedang' if skor_final >= THR_SEDANG else 'Rendah'

    # E. Kumpulkan keywords yang terdeteksi dari urgency signals
    words_set = set(teks_clean.split())

    # F. Keyword floor rule — koreksi distribusi shift (laporan pendek vs artikel berita panjang)
    # Hitung berapa kategori BERAT yang terpicu (minimal 1 keyword hit)
    CRITICAL_FEATURES = {'skor_kematian', 'skor_senjata', 'skor_kekerasan_fisik', 'skor_perampasan_paksa'}
    critical_hit = sum(
        1 for feat in CRITICAL_FEATURES
        if any(kw in words_set for kw in URGENCY_SIGNALS[feat])
    )
    total_hit = sum(
        1 for feat, kws in URGENCY_SIGNALS.items()
        if feat != 'skor_ringan' and any(kw in words_set for kw in kws)
    )
    # Jika 3+ kategori berat terpicu → minimal Tinggi
    # Jika 2+ kategori berat ATAU 3+ kategori apapun → minimal Sedang
    if critical_hit >= 3:
        floor = 'Tinggi'
    elif critical_hit >= 2 or total_hit >= 3:
        floor = 'Sedang'
    else:
        floor = None

    if floor == 'Tinggi' and kategori != 'Tinggi':
        skor_final = max(skor_final, THR_TINGGI)
        kategori = 'Tinggi'
    elif floor == 'Sedang' and kategori == 'Rendah':
        skor_final = max(skor_final, THR_SEDANG)
        kategori = 'Sedang'
    detected = []
    for kws in URGENCY_SIGNALS.values():
        for kw in kws:
            if kw in words_set and kw not in detected:
                detected.append(kw)

    return {
        "teks_bersih": teks_clean,
        "risk_score": round(skor_final, 2),
        "kategori": kategori,
        "keywords_detected": detected,
    }