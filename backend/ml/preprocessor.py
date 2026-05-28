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
# preprocessor.py ada di backend/ml/ → models/ ada di folder yang sama
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "models")

# 3. Load Model & Metadata
try:
    model_final = joblib.load(os.path.join(MODEL_DIR, 'model_final.pkl'))
    vectorizer = joblib.load(os.path.join(MODEL_DIR, 'vectorizer.pkl'))

    with open(os.path.join(MODEL_DIR, 'model_metadata.json'), 'r') as f:
        metadata = json.load(f)

    URGENCY_SIGNALS = metadata['urgency_signals']
    FEATURE_COLS = list(URGENCY_SIGNALS.keys())
    THR_TINGGI = metadata.get('threshold_tinggi', 67.0)
    THR_SEDANG = metadata.get('threshold_sedang', 34.0)

    # SHAP explainer — init sekali saat server start
    try:
        import shap as _shap
        _explainer = _shap.TreeExplainer(model_final)
        _feature_names = list(vectorizer.get_feature_names_out()) + list(FEATURE_COLS)
        _HAS_SHAP = True
    except Exception as _shap_err:
        _explainer = None
        _feature_names = []
        _HAS_SHAP = False
        print(f"[SHAP] Explainer init gagal (non-critical): {_shap_err}")

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

SAFE_CONTEXT = {
    'mainan', 'beli', 'toko', 'pasar', 'jual', 'koleksi',
    'replika', 'hiasan', 'hadiah', 'souvenir', 'pajang',
}

ACTIVE_SIGNALS = [
    'sedang berlangsung', 'masih berlangsung', 'sedang terjadi',
    'tolong segera datang', 'tolong segera ke sini', 'tolong segera bantu',
    'butuh bantuan segera', 'segera datang', 'sebelum ada korban',
    'darurat', 'ada yang terluka', 'ada korban',
]

PUBLIC_RISK_SIGNALS = [
    'balap liar', 'tawuran', 'gerombolan', 'kerumunan massa',
    'menutup jalan', 'blokade jalan', 'blokir jalan',
    'anarkis', 'rusuh', 'bentrok',
    'meresahkan warga', 'meresahkan masyarakat',
    'premanisme', 'geng motor',
]

PROPERTY_CRIME_SIGNALS = [
    'motor dicuri', 'mobil dicuri', 'kendaraan dicuri',
    'motor hilang', 'mobil hilang', 'kehilangan motor', 'kehilangan mobil',
    'dicopet', 'dijambret', 'dibobol', 'dijebol',
    'hp dicuri', 'laptop dicuri', 'dompet dicuri', 'tas dicuri',
]

URGENCY_LABEL: dict[str, str] = {
    'skor_kematian':         'Sinyal Kematian',
    'skor_senjata':          'Sinyal Senjata',
    'skor_kekerasan_fisik':  'Kekerasan Fisik',
    'skor_perampasan_paksa': 'Perampasan Paksa',
    'skor_pidana_berat':     'Pidana Berat',
    'skor_harta':            'Kerugian Harta',
    'skor_ringan':           'Pelanggaran Ringan',
}

_TIPE_WEIGHTS: list[tuple[str, list[str], float]] = [
    ('Pembunuhan / Penganiayaan', ['skor_kematian'],                        1.5),
    ('Senjata Berbahaya',          ['skor_senjata'],                         1.5),
    ('Kekerasan Fisik',            ['skor_kekerasan_fisik'],                 1.2),
    ('Perampokan / Pencurian',     ['skor_perampasan_paksa', 'skor_harta'], 1.3),
    ('Pidana Berat',               ['skor_pidana_berat'],                    1.0),
    ('Kriminalitas Ringan',        ['skor_ringan'],                          1.0),
]


def _kw_match(kw: str, teks_clean: str, words_set: set) -> bool:
    """Word-exact match untuk keyword 1 kata; substring untuk frasa multi-kata."""
    if ' ' in kw:
        return kw in teks_clean
    return kw in words_set


def tentukan_tipe_kejahatan(teks_clean: str) -> str:
    """Klasifikasi tipe kejahatan: pilih kategori dengan weighted urgency score tertinggi."""
    scores = dict(zip(FEATURE_COLS, hitung_urgensi(teks_clean)[0]))
    best_tipe  = 'Umum / Tidak Terklasifikasi'
    best_score = 0.0
    for tipe, feats, weight in _TIPE_WEIGHTS:
        score = sum(scores.get(f, 0.0) for f in feats) * weight
        if score > best_score:
            best_score = score
            best_tipe  = tipe
    return best_tipe


def compute_shap_explanation(teks_input: str) -> dict:
    """Hitung SHAP values + tipe kejahatan untuk satu teks laporan."""
    teks_clean = bersihkan_teks(teks_input)
    tipe = tentukan_tipe_kejahatan(teks_clean)

    if not _HAS_SHAP or _explainer is None:
        return {"tipe_kejahatan": tipe, "shap_features": [], "base_value": 0.0}

    X_tfidf  = vectorizer.transform([teks_clean])
    X_urgensi = hitung_urgensi(teks_clean)
    X_final  = hstack([X_tfidf, sp.csr_matrix(X_urgensi)])

    sv = _explainer.shap_values(X_final.toarray())[0]
    base = float(_explainer.expected_value)

    idx_sorted = np.argsort(np.abs(sv))[::-1][:8]
    features = []
    for idx in idx_sorted:
        raw_name = _feature_names[idx]
        label = URGENCY_LABEL.get(raw_name, raw_name)
        features.append({
            "name":  raw_name,
            "label": label,
            "value": round(float(sv[idx]), 3),
        })

    return {
        "tipe_kejahatan": tipe,
        "shap_features":  features,
        "base_value":     round(base, 2),
    }


def jalankan_pipeline_ml(teks_input: str):
    """Fungsi utama untuk menjalankan seluruh proses ML."""
    teks_clean = bersihkan_teks(teks_input)
    teks_lower = teks_input.lower()
    words_set  = set(teks_clean.split())

    X_tfidf  = vectorizer.transform([teks_clean])
    X_urgensi = hitung_urgensi(teks_clean)
    X_final  = hstack([X_tfidf, sp.csr_matrix(X_urgensi)])

    skor_raw   = model_final.predict(X_final)[0]
    skor_final = float(np.clip(skor_raw, 0.0, 100.0))

    is_safe = any(w in words_set for w in SAFE_CONTEXT)
    if is_safe:
        skor_final *= 0.5

    CRITICAL_FEATURES = {'skor_kematian', 'skor_senjata', 'skor_kekerasan_fisik', 'skor_perampasan_paksa'}
    critical_hit = sum(
        1 for feat in CRITICAL_FEATURES
        if any(_kw_match(kw, teks_clean, words_set) for kw in URGENCY_SIGNALS[feat])
    )
    total_hit = sum(
        1 for feat, kws in URGENCY_SIGNALS.items()
        if feat != 'skor_ringan' and any(_kw_match(kw, teks_clean, words_set) for kw in kws)
    )
    has_public_risk    = any(sig in teks_lower for sig in PUBLIC_RISK_SIGNALS)
    has_property_crime = any(sig in teks_lower for sig in PROPERTY_CRIME_SIGNALS)

    thr_crit  = 4 if is_safe else 3
    thr_mixed = 3 if is_safe else 2
    thr_total = 4 if is_safe else 3

    if critical_hit >= thr_crit:
        floor = 'Tinggi'
    elif critical_hit >= thr_mixed or total_hit >= thr_total:
        floor = 'Sedang'
    elif (has_public_risk or has_property_crime) and not is_safe:
        floor = 'Sedang'
    else:
        floor = None

    if floor == 'Tinggi':
        skor_final = max(skor_final, THR_TINGGI)
    elif floor == 'Sedang':
        skor_final = max(skor_final, THR_SEDANG)

    if any(sig in teks_lower for sig in ACTIVE_SIGNALS):
        skor_final = max(skor_final, THR_TINGGI)

    kategori = 'Tinggi' if skor_final >= THR_TINGGI else 'Sedang' if skor_final >= THR_SEDANG else 'Rendah'

    detected = []
    for kws in URGENCY_SIGNALS.values():
        for kw in kws:
            if _kw_match(kw, teks_clean, words_set) and kw not in detected:
                detected.append(kw)

    return {
        "teks_bersih": teks_clean,
        "risk_score": round(skor_final, 2),
        "kategori": kategori,
        "keywords_detected": detected,
    }
