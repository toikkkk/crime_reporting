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

    # SHAP explainer
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
    """Menghitung 7 skor urgensi berdasarkan kamus (count/total_words — sama dengan training)."""
    words = teks_clean.split()
    total_words = max(len(words), 1)
    return [[float(sum(words.count(kw) for kw in URGENCY_SIGNALS[fitur])) / total_words for fitur in FEATURE_COLS]]

SAFE_CONTEXT = {
    'mainan', 'beli', 'toko', 'pasar', 'jual', 'koleksi',
    'replika', 'hiasan', 'hadiah', 'souvenir', 'pajang',
}

PUBLIC_RISK_SIGNALS = [
    'balap liar', 'trek liar', 'geng motor', 'kebut-kebutan',
    'tawuran', 'tawur', 'bentrok massa', 'kerusuhan', 'anarkis',
    'gerombolan', 'kawanan', 'massa menyerang', 'blokade jalan',
    'tutup jalan', 'menutup jalan', 'sweeping', 'premanisme',
]

PROPERTY_CRIME_SIGNALS = [
    'dibobol', 'jebol', 'rumah dibobol', 'kos dibobol', 'kontrakan dibobol',
    'motor hilang', 'mobil hilang', 'kendaraan hilang', 'motor raib', 'mobil raib',
    'dicopet', 'dijambret', 'tas dirampas', 'hp dirampas', 'dompet dirampas',
    'curanmor', 'curas', 'curat', 'pembobolan', 'motor dicuri', 'mobil dicuri',
    'kehilangan motor', 'kehilangan mobil',
]

ACTIVE_SIGNALS = [
    # situasi sedang berlangsung
    'sedang berlangsung', 'masih berlangsung', 'sedang terjadi',
    'masih di dalam', 'masih di sini', 'pelaku masih', 'masih ada di',
    'mereka masih', 'masih berlangsung', 'saat ini masih',
    # minta bantuan segera
    'tolong segera datang', 'tolong segera ke sini', 'tolong segera bantu',
    'tolong segera', 'butuh bantuan segera', 'segera datang',
    'segera ke sini', 'segera kirim', 'segera bantu',
    'mohon segera', 'tolong kirim', 'kirim bantuan',
    'minta bantuan segera', 'tolong cepat', 'cepat ke sini',
    'sebelum ada korban', 'darurat', 'kondisi darurat',
    # ada korban / korban luka
    'ada korban', 'ada yang terluka', 'ada yang luka',
    'ada siswa luka', 'ada warga luka', 'ada korban luka',
    'luka parah', 'luka berat', 'luka serius', 'luka parah',
    'berdarah', 'sudah berdarah', 'kena sabetan', 'kena tusukan',
    'tidak sadarkan diri', 'pingsan', 'kritis', 'kondisi kritis',
    # ancaman aktif
    'mengancam korban', 'menodongkan', 'mau nusuk', 'mau membunuh',
    'todong', 'ancam', 'sembunyi',
]

ADMIN_SIGNALS = {
    'kehilangan ktp', 'kehilangan sim', 'kehilangan bpkb',
    'kehilangan paspor', 'kehilangan ijazah', 'surat kehilangan',
    'keperluan administrasi', 'buat surat keterangan',
    'surat keterangan kehilangan', 'penggantian ktp', 'penggantian sim',
    'laporan kehilangan untuk', 'blokir atm', 'pemblokiran atm',
}

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

# Keyword-based crime type classifier — lebih akurat dari urgency-score saja
_CRIME_TYPE_KEYWORDS: list[tuple[str, list[str]]] = [
    ('Pembunuhan / Penganiayaan Berat', [
        'bunuh', 'mati', 'tewas', 'meninggal', 'jenazah', 'mayat',
        'pembunuhan', 'dibunuh', 'membunuh', 'korban jiwa',
    ]),
    ('Perampokan Bersenjata', [
        'rampas', 'rampok', 'begal', 'merampas', 'dirampas',
        'dirampok', 'dibegal', 'todong', 'ditodong', 'pepet',
        'mengancam korban', 'paksa serahkan',
    ]),
    ('Tawuran / Kerusuhan Massa', [
        'tawuran', 'tawur', 'rusuh', 'kerusuhan', 'bentrok', 'bentrokan',
        'anarkis', 'amuk', 'massa menyerang', 'kelompok menyerang',
    ]),
    ('Penganiayaan / Kekerasan Fisik', [
        'aniaya', 'penganiayaan', 'pukul', 'hajar', 'tusuk', 'tikam',
        'sabetan', 'melukai', 'memukul', 'ngamuk', 'menganiaya',
        'dipukul', 'dihajar', 'ditusuk', 'mau nusuk', 'serangan fisik',
    ]),
    ('Kejahatan Senjata Berbahaya', [
        'bom', 'molotov', 'pistol', 'senapan', 'senjata api', 'tembak',
        'celurit', 'golok', 'parang', 'linggis', 'bersenjata',
    ]),
    ('Pencurian Kendaraan', [
        'begal motor', 'motor dicuri', 'motor hilang', 'mobil dicuri',
        'mobil hilang', 'kendaraan dicuri', 'kunci t', 'rampas motor',
        'sepeda dicuri', 'kehilangan motor', 'kehilangan mobil',
    ]),
    ('Pencurian / Pencopetan', [
        'dicopet', 'dijambret', 'dibobol', 'dijebol', 'maling',
        'tas dicuri', 'hp dicuri', 'dompet dicuri', 'laptop dicuri',
        'pencurian', 'mencuri',
    ]),
    ('Balap Liar / Gangguan Lalu Lintas', [
        'balap liar', 'geng motor', 'knalpot brong', 'menutup jalan',
        'blokade jalan', 'kebut-kebutan', 'arena balap', 'trek liar',
    ]),
    ('Penipuan / Kejahatan Siber', [
        'penipuan', 'ditipu', 'menipu', 'tipu', 'scam', 'rekening',
        'transfer uang', 'tidak dikirim', 'akun hilang', 'akun palsu',
        'penjual kabur', 'online shop', 'instagram', 'tokopedia',
    ]),
    ('Vandalisme / Perusakan Properti', [
        'vandal', 'dicoret', 'coret-coret', 'cat semprot', 'graffiti',
        'dirusak', 'dipatahkan', 'memecahkan', 'kaca pecah',
        'merusak properti', 'spion dipatahkan',
    ]),
    ('Sengketa / Perselisihan Perdata', [
        'sengketa', 'mediasi', 'batas tanah', 'batas pagar',
        'perselisihan', 'pagar rumah', 'hak tanah',
    ]),
    ('Laporan Kehilangan / Administrasi', [
        'kehilangan ktp', 'surat kehilangan', 'ktp jatuh', 'ktp hilang',
        'tidak ada tindak kriminal', 'keperluan administrasi',
        'buat surat keterangan', 'surat keterangan kehilangan',
    ]),
]


def _kw_match(kw: str, teks_clean: str, words_set: set) -> bool:
    """Word-exact match untuk keyword 1 kata; substring untuk frasa multi-kata."""
    if ' ' in kw:
        return kw in teks_clean
    return kw in words_set


def tentukan_tipe_kejahatan(teks_clean: str, teks_original: str = '') -> str:
    """Klasifikasi tipe kejahatan: keyword-based (prioritas) + fallback urgency score."""
    teks_lower    = teks_original.lower() if teks_original else ''
    teks_combined = teks_lower + ' ' + teks_clean
    words_combined = set(teks_combined.split())

    best_tipe  = None
    best_count = 0
    for tipe, keywords in _CRIME_TYPE_KEYWORDS:
        # Wajib pakai _kw_match() — "api" in "tapi" adalah True di Python → false positive
        count = sum(1 for kw in keywords if _kw_match(kw, teks_combined, words_combined))
        if count > best_count:
            best_count = count
            best_tipe  = tipe

    if best_tipe and best_count > 0:
        return best_tipe

    # Fallback: urgency-score based jika tidak ada keyword yang cocok
    scores = dict(zip(FEATURE_COLS, hitung_urgensi(teks_clean)[0]))
    best_score = 0.0
    best_tipe  = 'Kriminalitas Umum'
    for tipe, feats, weight in _TIPE_WEIGHTS:
        score = sum(scores.get(f, 0.0) for f in feats) * weight
        if score > best_score:
            best_score = score
            best_tipe  = tipe
    return best_tipe


def compute_shap_explanation(teks_input: str) -> dict:
    """Hitung SHAP values + tipe kejahatan untuk satu teks laporan."""
    teks_clean = bersihkan_teks(teks_input)
    tipe = tentukan_tipe_kejahatan(teks_clean, teks_original=teks_input)

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

    X_tfidf   = vectorizer.transform([teks_clean])
    X_urgensi = hitung_urgensi(teks_clean)
    X_final   = hstack([X_tfidf, sp.csr_matrix(X_urgensi)])

    skor_final = float(np.clip(model_final.predict(X_final)[0], 0.0, 100.0))

    # SAFE_CONTEXT: teks menyebut konteks aman (beli/toko/pasar) → tekan skor
    if any(w in words_set for w in SAFE_CONTEXT):
        skor_final *= 0.5

    # ADMIN_SIGNALS: laporan kehilangan dokumen administratif → cap Rendah
    if any(sig in teks_lower for sig in ADMIN_SIGNALS):
        skor_final = min(skor_final, THR_SEDANG - 1)

    # KEYWORD FLOOR RULE: hitung keyword kritis dari URGENCY_SIGNALS
    # Gunakan _kw_match() bukan substring — hindari false positive "api" in "tapi"
    critical_keywords = (
        URGENCY_SIGNALS['skor_kematian'] +
        URGENCY_SIGNALS['skor_senjata'] +
        URGENCY_SIGNALS['skor_kekerasan_fisik']
    )
    other_keywords = (
        URGENCY_SIGNALS['skor_perampasan_paksa'] +
        URGENCY_SIGNALS['skor_pidana_berat']
    )
    critical_hit = sum(1 for kw in critical_keywords if _kw_match(kw, teks_clean, words_set))
    total_hit    = critical_hit + sum(1 for kw in other_keywords if _kw_match(kw, teks_clean, words_set))

    if critical_hit >= 3:
        skor_final = max(skor_final, THR_TINGGI)
    elif critical_hit >= 2 or total_hit >= 3:
        skor_final = max(skor_final, THR_SEDANG)

    # PUBLIC_RISK_SIGNALS: balap liar, tawuran, gerombolan → floor Sedang
    if any(sig in teks_lower for sig in PUBLIC_RISK_SIGNALS):
        skor_final = max(skor_final, THR_SEDANG)

    # PROPERTY_CRIME_SIGNALS: dibobol, motor hilang, dicopet → floor Sedang
    if any(sig in teks_lower for sig in PROPERTY_CRIME_SIGNALS):
        skor_final = max(skor_final, THR_SEDANG)

    # ACTIVE_SIGNALS: situasi darurat aktif / ada korban → paksa Tinggi
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
