"""
preprocessor.py
===============
Preprocessing teks untuk production (real-time inference).
Dipakai saat laporan baru masuk dari masyarakat.

PENTING: File ini TIDAK mengandung SMOTE.
SMOTE hanya untuk augmentasi training data offline (lihat notebooks/).

Pipeline:
    Step 1 — Normalisasi informal → formal
    Step 2 — Cleaning (URL, angka, tanda baca)
    Step 3 — Hapus stopwords
    Step 4 — Stemming (Sastrawi)
    Step 5 — Ekstrak keyword highlights
"""

import re
from typing import Optional

# ================================================================
# KAMUS NORMALISASI INFORMAL → FORMAL
# ================================================================
KAMUS_INFORMAL: dict[str, str] = {
    # Pelaku
    "maling": "pencuri", "begal": "perampok", "copet": "pencopet",
    "bajingan": "pelaku", "penjahat": "pelaku", "bandit": "pelaku",
    "residivis": "pelaku",
    # Aksi kejahatan
    "dibacok": "ditusuk", "dihajar": "dipukul", "digebuk": "dipukul",
    "dicolong": "dicuri", "diembat": "dicuri", "disikat": "dicuri",
    "ketangkep": "ditangkap", "kecokok": "ditangkap",
    "dibekuk": "ditangkap", "diringkus": "ditangkap",
    "kabur": "melarikan diri", "minggat": "melarikan diri",
    # Korban
    "tewas": "meninggal", "mati": "meninggal", "modar": "meninggal",
    "sekarat": "kritis",
    # Narkoba
    "sabu": "narkotika", "ganja": "narkotika",
    "ekstasi": "narkotika", "pil koplo": "narkotika",
    # Umum
    "ngelapor": "melaporkan", "ngadu": "melapor",
    "babak belur": "luka parah", "bonyok": "luka memar",
    # Singkatan
    "polda": "kepolisian daerah", "polres": "kepolisian resort",
    "polsek": "kepolisian sektor", "wna": "warga negara asing",
    "wni": "warga negara indonesia",
    "kpk": "komisi pemberantasan korupsi",
    "bnn": "badan narkotika nasional",
    "reskrim": "reserse kriminal",
    # Kata tidak baku
    "gak": "tidak", "nggak": "tidak", "udah": "sudah",
    "emang": "memang", "yg": "yang", "dgn": "dengan",
    "utk": "untuk", "krn": "karena", "sdh": "sudah",
    "tsb": "tersebut", "tdk": "tidak",
}

# ================================================================
# STOPWORDS
# CATATAN: "tidak", "sangat", dll sengaja DIKELUARKAN dari stopwords
# karena mengubah makna urgensi kalimat secara signifikan.
# Contoh: "tidak ada korban" vs "ada korban" — maknanya berlawanan.
# ================================================================
STOPWORDS_ID: set[str] = {
    "dan", "di", "ke", "dari", "ini", "itu", "dengan",
    "untuk", "pada", "adalah", "dalam", "juga",
    "saat", "akan", "oleh", "ada", "karena", "sehingga", "namun",
    "tetapi", "atau", "jika", "maka", "setelah", "sebelum", "ketika",
    "agar", "bila", "seperti", "antara", "tersebut", "telah", "bisa",
    "dapat", "harus", "selain", "serta", "bahwa", "pun", "lagi",
    "atas", "bawah", "lebih", "cukup", "hanya", "masih",
    "belum", "sedang", "memang", "hingga", "sampai", "lalu",
    "kemudian", "hal", "para", "salah", "satu", "dua", "tiga",
    "pertama", "kedua", "ketiga", "mereka", "kami", "kita",
    "saya", "anda", "ia", "dia", "nya", "pagi", "siang", "malam",
    "hari", "minggu", "bulan", "tahun", "waktu", "tempat",
    "pria", "wanita", "orang", "seorang", "baik", "jelas",
    # "tidak" dan "sangat" TIDAK ada di sini — lihat catatan di atas
}

# ================================================================
# KEYWORD PER URGENSI (untuk dashboard highlighting)
# ================================================================
KEYWORDS_URGENSI: dict[str, list[str]] = {
    "Tinggi": [
        "bunuh", "pembunuhan", "mutilasi", "meninggal",
        "perkosa", "pemerkosaan", "kekerasan seksual",
        "rampok", "bersenjata", "senjata api", "tembak",
        "culik", "sandera", "bom", "teror", "ledakan",
        "tikam", "bacok", "tusuk", "luka berat",
    ],
    "Sedang": [
        "curi", "pencurian", "jambret", "copet",
        "aniaya", "penganiayaan", "pukul", "keroyok",
        "narkoba", "narkotika",
        "tipu", "penipuan", "investasi bodong",
        "korupsi", "suap", "gratifikasi",
    ],
    "Rendah": [
        "vandalisme", "coret", "grafiti",
        "perkelahian", "ribut", "bentrok",
        "pungli", "pungutan liar",
        "parkir liar", "gangguan",
        "penipuan online", "scam",
    ],
}

# ================================================================
# STEMMER (lazy-load agar tidak blocking saat import)
# ================================================================
_stemmer = None

def _get_stemmer():
    global _stemmer
    if _stemmer is None:
        try:
            from Sastrawi.Stemmer.StemmerFactory import StemmerFactory
            _stemmer = StemmerFactory().create_stemmer()
        except ImportError:
            # Fallback: kembalikan teks apa adanya
            class _NoopStemmer:
                def stem(self, text): return text
            _stemmer = _NoopStemmer()
    return _stemmer


# ================================================================
# STEP 1 — Normalisasi informal
# ================================================================
def normalisasi_informal(teks: str) -> str:
    teks = teks.lower()
    for informal, formal in KAMUS_INFORMAL.items():
        teks = re.sub(r'\b' + re.escape(informal) + r'\b', formal, teks)
    return teks


# ================================================================
# STEP 2 — Cleaning
# ================================================================
def bersihkan_teks(teks: str) -> str:
    if not teks or not isinstance(teks, str):
        return ""
    teks = re.sub(r'http\S+|www\S+', '', teks)       # hapus URL
    teks = re.sub(r'\S+@\S+', '', teks)               # hapus email
    teks = re.sub(r'\b\d+\b', '', teks)               # hapus angka berdiri sendiri
    teks = re.sub(r'[^\w\s]', ' ', teks)              # hapus tanda baca
    teks = re.sub(r'\s+', ' ', teks).strip()
    return teks


# ================================================================
# STEP 3 — Hapus stopwords
# ================================================================
def hapus_stopwords(teks: str) -> str:
    kata_kata = teks.split()
    return ' '.join([
        k for k in kata_kata
        if k not in STOPWORDS_ID and len(k) > 2
    ])


# ================================================================
# STEP 4 — Stemming
# ================================================================
def stemming(teks: str) -> str:
    return _get_stemmer().stem(teks)


# ================================================================
# STEP 5 — Ekstrak keyword highlights
# Catatan: ekstraksi dari teks ORIGINAL (sebelum stemming)
# agar keyword masih terbaca manusia di dashboard
# ================================================================
def ekstrak_keywords(teks_original: str, label: Optional[str] = None) -> str:
    teks_lower = teks_original.lower()
    found = []

    # Prioritaskan keyword sesuai label prediksi
    if label and label in KEYWORDS_URGENSI:
        for kw in KEYWORDS_URGENSI[label]:
            if kw in teks_lower:
                found.append(kw)

    # Tambahkan keyword dari label lain yang juga muncul
    for lbl, kws in KEYWORDS_URGENSI.items():
        if lbl != label:
            for kw in kws:
                if kw in teks_lower and kw not in found:
                    found.append(kw)

    return ', '.join(found[:10])


# ================================================================
# PIPELINE UTAMA — dipakai di production (FastAPI endpoint)
# ================================================================
def preprocess(teks: str) -> str:
    """
    Jalankan full preprocessing pipeline (step 1-4).
    Input : teks mentah dari laporan masyarakat
    Output: teks bersih siap masuk model ML
    """
    if not teks or not isinstance(teks, str):
        return ""
    teks = normalisasi_informal(teks)
    teks = bersihkan_teks(teks)
    teks = hapus_stopwords(teks)
    teks = stemming(teks)
    return teks


def preprocess_with_keywords(teks: str, label: Optional[str] = None) -> dict:
    """
    Preprocessing + ekstrak keywords sekaligus.
    Dipakai saat laporan baru masuk — simpan kedua hasilnya ke DB.

    Returns:
        {
            "deskripsi_bersih": str,
            "keywords_highlight": str
        }
    """
    teks_bersih = preprocess(teks)
    keywords = ekstrak_keywords(teks_original=teks, label=label)
    return {
        "deskripsi_bersih": teks_bersih,
        "keywords_highlight": keywords,
    }


# ================================================================
# QUICK TEST — jalankan langsung: python preprocessor.py
# ================================================================
if __name__ == "__main__":
    contoh = (
        "Seorang maling motor dibekuk polsek setempat setelah "
        "diringkus warga. Pelaku tewas di lokasi akibat dihajar massa "
        "yang emosi. Korban luka berat dibawa ke RS terdekat."
    )
    print("=== TEST PREPROCESSOR ===")
    print(f"Input    : {contoh}")
    print()
    hasil = preprocess_with_keywords(contoh)
    print(f"Bersih   : {hasil['deskripsi_bersih']}")
    print(f"Keywords : {hasil['keywords_highlight']}")
