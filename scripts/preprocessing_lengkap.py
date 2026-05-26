import pandas as pd
import re
import warnings
from collections import Counter

warnings.filterwarnings('ignore')

# KONFIGURASI
INPUT_FILE  = "dataset_kriminal_final.csv"
OUTPUT_FILE = "dataset_siap_training.csv"

# KAMUS NORMALISASI INFORMAL → FORMAL
KAMUS_INFORMAL = {
    # Pelaku
    "maling"        : "pencuri",
    "begal"         : "perampok",
    "copet"         : "pencopet",
    "bajingan"      : "pelaku",
    "penjahat"      : "pelaku",
    "bandit"        : "pelaku",
    "residivis"     : "pelaku",
    # Aksi kejahatan
    "dibacok"       : "ditusuk",
    "dihajar"       : "dipukul",
    "digebuk"       : "dipukul",
    "dicolong"      : "dicuri",
    "diembat"       : "dicuri",
    "disikat"       : "dicuri",
    "ketangkep"     : "ditangkap",
    "kecokok"       : "ditangkap",
    "dibekuk"       : "ditangkap",
    "diringkus"     : "ditangkap",
    "kabur"         : "melarikan diri",
    "minggat"       : "melarikan diri",
    # Korban
    "tewas"         : "meninggal",
    "mati"          : "meninggal",
    "modar"         : "meninggal",
    "sekarat"       : "kritis",
    # Narkoba
    "sabu"          : "narkotika",
    "ganja"         : "narkotika",
    "ekstasi"       : "narkotika",
    "pil koplo"     : "narkotika",
    # Umum
    "ngelapor"      : "melaporkan",
    "ngadu"         : "melapor",
    "babak belur"   : "luka parah",
    "bonyok"        : "luka memar",
    # Singkatan
    "polda"         : "kepolisian daerah",
    "polres"        : "kepolisian resort",
    "polsek"        : "kepolisian sektor",
    "wna"           : "warga negara asing",
    "wni"           : "warga negara indonesia",
    "kpk"           : "komisi pemberantasan korupsi",
    "bnn"           : "badan narkotika nasional",
    "reskrim"       : "reserse kriminal",
    # Kata tidak baku
    "gak"           : "tidak",
    "nggak"         : "tidak",
    "udah"          : "sudah",
    "emang"         : "memang",
    "yg"            : "yang",
    "dgn"           : "dengan",
    "utk"           : "untuk",
    "krn"           : "karena",
    "sdh"           : "sudah",
    "tsb"           : "tersebut",
    "tdk"           : "tidak",
}

# STOPWORDS
STOPWORDS_ID = {
    "yang", "dan", "di", "ke", "dari", "ini", "itu", "dengan",
    "untuk", "pada", "adalah", "dalam", "tidak", "juga", "sudah",
    "saat", "akan", "oleh", "ada", "karena", "sehingga", "namun",
    "tetapi", "atau", "jika", "maka", "setelah", "sebelum", "ketika",
    "agar", "bila", "seperti", "antara", "tersebut", "telah", "bisa",
    "dapat", "harus", "selain", "serta", "bahwa", "pun", "lagi",
    "atas", "bawah", "lebih", "sangat", "cukup", "hanya", "masih",
    "belum", "sedang", "memang", "hingga", "sampai", "lalu",
    "kemudian", "hal", "para", "salah", "satu", "dua", "tiga",
    "pertama", "kedua", "ketiga", "mereka", "kami", "kita",
    "saya", "anda", "ia", "dia", "nya", "pagi", "siang", "malam",
    "hari", "minggu", "bulan", "tahun", "waktu", "tempat",
    "pria", "wanita", "orang", "seorang", "baik", "jelas",
}

# KEYWORD PER URGENSI (untuk dashboard highlighting)
KEYWORDS_URGENSI = {
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

# KEYWORD RELABELING
# Keyword yang menandakan konten TINGGI
KEYWORDS_TINGGI = [
    "meninggal", "tewas", "korban jiwa", "nyawa",
    "dibunuh", "pembunuhan", "membunuh",
    "mutilasi", "dimutilasi",
    "ditusuk", "ditembak", "dibacok",
    "diperkosa", "pemerkosaan",
    "diculik", "penculikan",
    "disandera", "penyanderaan",
    "bom", "terorisme", "teroris",
    "senjata api", "pistol", "senapan",
]

# Keyword yang menandakan konten SEDANG
KEYWORDS_SEDANG = [
    "dicuri", "pencurian", "dijambret", "dirampok",
    "dianiaya", "penganiayaan", "dipukuli", "dikeroyok",
    "narkoba", "narkotika", "sabu", "ganja",
    "penipuan", "menipu", "ditipu",
    "korupsi", "kpk",
    "ditangkap", "diringkus", "dibekuk",
]

# FUNGSI PREPROCESSING
def normalisasi_informal(teks):
    teks = teks.lower()
    for informal, formal in KAMUS_INFORMAL.items():
        teks = re.sub(r'\b' + re.escape(informal) + r'\b', formal, teks)
    return teks

def bersihkan_teks(teks):
    if not teks or not isinstance(teks, str):
        return ""
    teks = re.sub(r'http\S+|www\S+', '', teks)
    teks = re.sub(r'\S+@\S+', '', teks)
    teks = re.sub(r'\b\d+\b', '', teks)
    teks = re.sub(r'[^\w\s]', ' ', teks)
    teks = re.sub(r'\s+', ' ', teks).strip()
    return teks

def hapus_stopwords(teks):
    kata_kata = teks.split()
    return ' '.join([k for k in kata_kata if k not in STOPWORDS_ID and len(k) > 2])

def stemming(teks):
    try:
        from Sastrawi.Stemmer.StemmerFactory import StemmerFactory
        factory = StemmerFactory()
        stemmer = factory.create_stemmer()
        return stemmer.stem(teks)
    except ImportError:
        print("  ⚠️  PySastrawi tidak terinstall, skip stemming")
        return teks

def pipeline_preprocessing(teks):
    if not teks or not isinstance(teks, str):
        return ""
    teks = normalisasi_informal(teks)
    teks = bersihkan_teks(teks)
    teks = hapus_stopwords(teks)
    teks = stemming(teks)
    return teks

def ekstrak_keywords(teks, label):
    teks_lower = teks.lower()
    found = []
    for kw in KEYWORDS_URGENSI.get(label, []):
        if kw in teks_lower:
            found.append(kw)
    for lbl, kws in KEYWORDS_URGENSI.items():
        if lbl != label:
            for kw in kws:
                if kw in teks_lower and kw not in found:
                    found.append(kw)
    return ', '.join(found[:10])

# FUNGSI RELABELING
def relabel(row):
    """Koreksi label berdasarkan konten artikel"""
    teks       = str(row.get('deskripsi_kejadian', '')).lower()
    label_asal = row['label_urgensi']

    ada_tinggi = any(kw in teks for kw in KEYWORDS_TINGGI)
    ada_sedang = any(kw in teks for kw in KEYWORDS_SEDANG)

    if label_asal == 'Rendah':
        if ada_tinggi:
            return 'Tinggi'
        elif ada_sedang:
            return 'Sedang'
        return 'Rendah'

    elif label_asal == 'Sedang':
        if ada_tinggi:
            return 'Tinggi'
        return 'Sedang'

    # Tinggi tidak diturunkan
    return 'Tinggi'


# MAIN
def main():
    print("="*60)
    print("  PREPROCESSING LENGKAP DATASET KRIMINAL")
    print("  Input  :", INPUT_FILE)
    print("  Output :", OUTPUT_FILE)
    print("="*60)

    # STEP 1: LOAD DATA
    print("\n[1/6] Loading data...")
    try:
        df = pd.read_csv(INPUT_FILE, encoding='utf-8')
    except FileNotFoundError:
        print(f"❌ File '{INPUT_FILE}' tidak ditemukan!")
        return

    print(f"  Total rows   : {len(df)}")
    print(f"  Kolom        : {list(df.columns)}")
    print(f"\n  Distribusi label awal:")
    print(df['label_urgensi'].value_counts().to_string())

    # STEP 2: HAPUS DUPLIKAT & DATA TIDAK VALID
    print("\n[2/6] Hapus duplikat dan data tidak valid...")

    sebelum = len(df)
    df['deskripsi_kejadian'] = df['deskripsi_kejadian'].fillna('')
    df['lokasi_kejadian']    = df['lokasi_kejadian'].fillna('')
    df['waktu_kejadian']     = df['waktu_kejadian'].fillna('')

    # Hapus duplikat URL
    df = df.drop_duplicates(subset=['url'], keep='first')

    # Hapus deskripsi kosong atau terlalu pendek
    df = df[df['deskripsi_kejadian'].str.len() >= 100]
    df = df.reset_index(drop=True)

    print(f"  Sebelum : {sebelum} rows")
    print(f"  Sesudah : {len(df)} rows")
    print(f"  Dihapus : {sebelum - len(df)} rows")

    # Simpan teks original sebelum preprocessing
    df['deskripsi_original'] = df['deskripsi_kejadian'].copy()

    # STEP 3: PREPROCESSING TEKS
    print("\n[3/6] Preprocessing teks...")
    print("  (Stemming membutuhkan beberapa menit, harap tunggu)")

    total  = len(df)
    hasil  = []
    for i, teks in enumerate(df['deskripsi_kejadian']):
        hasil.append(pipeline_preprocessing(teks))
        if (i + 1) % 100 == 0 or (i + 1) == total:
            print(f"  Progress: {i+1}/{total} ({(i+1)/total*100:.1f}%)", end='\r')

    df['deskripsi_bersih'] = hasil
    print(f"\n  ✅ Preprocessing selesai")

    # Sample verifikasi
    print(f"\n  Sample:")
    print(f"    Original : {df['deskripsi_original'].iloc[0][:120]}")
    print(f"    Bersih   : {df['deskripsi_bersih'].iloc[0][:120]}")

    # STEP 4: EKSTRAK KEYWORD HIGHLIGHTS
    print("\n[4/6] Ekstrak keyword highlights...")

    df['keywords_highlight'] = df.apply(
        lambda row: ekstrak_keywords(
            row['deskripsi_original'],
            row['label_urgensi']
        ), axis=1
    )

    ada_kw = (df['keywords_highlight'] != '').sum()
    print(f"  Coverage : {ada_kw}/{len(df)} ({ada_kw/len(df)*100:.1f}%)")

    # STEP 5: RELABELING OTOMATIS
    print("\n[5/6] Relabeling otomatis...")

    df['label_asal']    = df['label_urgensi'].copy()
    df['label_urgensi'] = df.apply(relabel, axis=1)

    diubah = (df['label_asal'] != df['label_urgensi']).sum()
    print(f"  Total direlabel : {diubah} artikel")

    print(f"\n  Detail perubahan:")
    for asal in ['Tinggi', 'Sedang', 'Rendah']:
        for baru in ['Tinggi', 'Sedang', 'Rendah']:
            if asal != baru:
                n = ((df['label_asal'] == asal) & (df['label_urgensi'] == baru)).sum()
                if n > 0:
                    print(f"    {asal} → {baru} : {n} artikel")

    print(f"\n  Distribusi setelah relabeling:")
    print(df['label_urgensi'].value_counts().to_string())

    counts = df['label_urgensi'].value_counts()
    rasio  = counts.min() / counts.max()
    print(f"\n  Rasio min/max : {rasio:.2f}", end="")
    print(" ✅" if rasio >= 0.6 else " ⚠️  Imbalanced, akan di-SMOTE")

    # STEP 6: SMOTE BALANCING
    print("\n[6/6] SMOTE balancing...")

    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from imblearn.over_sampling import SMOTE

        label_map     = {'Tinggi': 0, 'Sedang': 1, 'Rendah': 2}
        label_map_inv = {v: k for k, v in label_map.items()}

        vectorizer   = TfidfVectorizer(max_features=5000, min_df=2)
        X            = vectorizer.fit_transform(df['deskripsi_bersih'].fillna(''))
        y            = df['label_urgensi'].map(label_map).values

        smote        = SMOTE(random_state=42)
        X_res, y_res = smote.fit_resample(X, y)

        n_original  = len(df)
        n_synthetic = len(y_res) - n_original

        print(f"  Data original  : {n_original}")
        print(f"  Data sintetis  : {n_synthetic}")
        print(f"  Total          : {len(y_res)}")

        # Buat teks dari data sintetis via inverse_transform
        # (menghasilkan kata-kata yang bermakna, bukan kosong)
        synthetic_texts = vectorizer.inverse_transform(X_res[n_original:])

        # Tandai data original
        df['is_synthetic'] = 'No'

        # Buat DataFrame data sintetis
        synthetic_rows = []
        for i, (words, label_idx) in enumerate(zip(synthetic_texts, y_res[n_original:])):
            label = label_map_inv[label_idx]
            teks_syn = ' '.join(words)
            synthetic_rows.append({
                'id'                 : f"syn_{i+1}",
                'judul_berita'       : f"[SYNTHETIC] {label} #{i+1}",
                'deskripsi_kejadian' : teks_syn,
                'lokasi_kejadian'    : '',
                'waktu_kejadian'     : '',
                'kategori_kejahatan' : 'SYNTHETIC',
                'label_urgensi'      : label,
                'label_asal'         : label,
                'sumber'             : 'SMOTE',
                'url'                : '',
                'scraped_at'         : '',
                'deskripsi_original' : teks_syn,
                'deskripsi_bersih'   : teks_syn,
                'keywords_highlight' : '',
                'is_synthetic'       : 'Yes',
            })

        df_synthetic = pd.DataFrame(synthetic_rows)
        df_final     = pd.concat([df, df_synthetic], ignore_index=True)
        df_final['id'] = range(1, len(df_final) + 1)

        print(f"\n  Distribusi setelah SMOTE:")
        for lbl in ['Tinggi', 'Sedang', 'Rendah']:
            n   = (df_final['label_urgensi'] == lbl).sum()
            pct = n / len(df_final) * 100
            bar = '█' * (n // 50)
            print(f"    {lbl:<8}: {n:>5} ({pct:.1f}%)  {bar}")

        rasio_final = df_final['label_urgensi'].value_counts()
        print(f"\n  Rasio min/max : {rasio_final.min()/rasio_final.max():.2f} ✅")

    except ImportError as e:
        print(f"  ⚠️  {e}")
        print("  Install: pip install imbalanced-learn scikit-learn")
        print("  Lanjut tanpa SMOTE...")
        df['is_synthetic'] = 'No'
        df_final = df.copy()

    # SIMPAN
    KOLOM_OUTPUT = [
        'id', 'judul_berita', 'deskripsi_kejadian',
        'lokasi_kejadian', 'waktu_kejadian',
        'kategori_kejahatan', 'label_urgensi', 'label_asal',
        'sumber', 'url', 'scraped_at',
        'deskripsi_original', 'deskripsi_bersih',
        'keywords_highlight', 'is_synthetic',
    ]

    for col in KOLOM_OUTPUT:
        if col not in df_final.columns:
            df_final[col] = ''

    df_final[KOLOM_OUTPUT].to_csv(OUTPUT_FILE, index=False, encoding='utf-8')

    # RINGKASAN
    print("\n" + "="*60)
    print("  RINGKASAN FINAL")
    print("="*60)
    print(f"  Output file      : {OUTPUT_FILE}")
    print(f"  Total rows       : {len(df_final)}")
    print(f"  Data original    : {(df_final['is_synthetic']=='No').sum()}")
    print(f"  Data sintetis    : {(df_final['is_synthetic']=='Yes').sum()}")
    print(f"\n  Distribusi label final:")
    for lbl in ['Tinggi', 'Sedang', 'Rendah']:
        n = (df_final['label_urgensi'] == lbl).sum()
        print(f"    {lbl:<8}: {n}")
    print(f"\n  Kolom untuk modeling:")
    print(f"    X (input)  = deskripsi_bersih")
    print(f"    y (target) = label_urgensi")
    print(f"    Extra      = keywords_highlight, lokasi_kejadian")
    print(f"\n  ⚠️  Gunakan is_synthetic=='No' untuk test set")
    print("="*60)
    print(f"\n✅ SELESAI! File siap untuk training model.")


if __name__ == "__main__":
    main()
