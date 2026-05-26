import requests
from bs4 import BeautifulSoup
import csv
import time
import random
import os
import re
from datetime import datetime
from urllib.parse import quote

OUTPUT_FILE   = "dataset_kriminal_final.csv"
MAX_PAGES     = 20
DELAY_MIN     = 2
DELAY_MAX     = 4
KEYWORD_DELAY = 12

HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/122.0.0.0 Safari/537.36'
    ),
    'Accept-Language': 'id-ID,id;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Referer': 'https://www.google.com/',
}

# KEYWORD → LABEL URGENSI
QUERIES = [
    # TINGGI
    ("pembunuhan",             "Tinggi", "Pembunuhan"),
    ("mutilasi",               "Tinggi", "Pembunuhan"),
    ("perampokan bersenjata",  "Tinggi", "Perampokan Bersenjata"),
    ("pemerkosaan",            "Tinggi", "Kekerasan Seksual"),
    ("penculikan",             "Tinggi", "Penculikan"),
    ("penyanderaan",           "Tinggi", "Penyanderaan"),
    ("terorisme",              "Tinggi", "Terorisme"),
    ("penembakan",             "Tinggi", "Kekerasan Senjata Api"),
    # SEDANG
    ("pencurian motor",        "Sedang", "Pencurian Kendaraan"),
    ("pencurian rumah",        "Sedang", "Pencurian"),
    ("jambret",                "Sedang", "Penjambretan"),
    ("penganiayaan",           "Sedang", "Penganiayaan"),
    ("narkoba ditangkap",      "Sedang", "Narkoba"),
    ("penipuan investasi",     "Sedang", "Penipuan"),
    ("korupsi ditangkap",      "Sedang", "Korupsi"),
    # RENDAH
    ("penipuan online",        "Rendah", "Penipuan Online"),
    ("vandalisme",             "Rendah", "Vandalisme"),
    ("perkelahian warga",      "Rendah", "Ketertiban Umum"),
    ("pungutan liar",          "Rendah", "Pelanggaran"),
    ("pencurian kecil",        "Rendah", "Pencurian Ringan"),
]

# FILTER RELEVANSI
RELEVANT_KEYWORDS = [
    'polisi', 'polres', 'polsek', 'polda',
    'tersangka', 'terdakwa', 'pelaku', 'korban',
    'ditangkap', 'diringkus', 'ditahan', 'dibekuk',
    'kejahatan', 'tindak pidana', 'kriminal',
    'tewas', 'meninggal', 'luka', 'dianiaya',
    'dicuri', 'dirampok', 'dijambret', 'ditipu',
    'narkoba', 'sabu', 'pengadilan', 'vonis', 'penjara',
]

IRRELEVANT_KEYWORDS = [
    'lagu', 'musik', 'film', 'drakor', 'artis',
    'konser', 'wisata', 'kuliner', 'fashion',
    'saham', 'cryptocurrency', 'diadaptasi',
    'chord', 'lirik', 'sinopsis',
]

def is_relevan(judul, deskripsi):
    teks = (judul + ' ' + deskripsi).lower()
    for kw in IRRELEVANT_KEYWORDS:
        if kw in teks:
            return False
    for kw in RELEVANT_KEYWORDS:
        if kw in teks:
            return True
    return False

# EKSTRAK LOKASI — dikonfirmasi akurat
def ekstrak_lokasi(teks):
    patterns = [
        # Pengadilan Negeri [Kota]
        r'Pengadilan Negeri\s+(?:\(PN\)\s+)?([A-Z][a-zA-Z\s]{3,25}?)(?:\s+karena|\s+menyatakan|\s+memvonis|\.|,)',
        # Polres/Polsek/Polda [Kota]
        r'(?:Polres|Polsek|Polda)\s+([A-Z][a-zA-Z\s]{3,25}?)(?:\s+mengungkap|\s+menangkap|\s+menyatakan|\.|,)',
        # Kecamatan/Kelurahan/Kabupaten/Kota eksplisit
        r'(?:Kecamatan|Kelurahan|Kabupaten|Kota)\s+([A-Z][a-zA-Z\s]{3,25}?)(?:\s*,|\s*\.|\s+menjadi|\s+yang)',
        # "di [Kota], [Provinsi]"
        r'di\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),\s*(?:Jawa|Sumatera|Kalimantan|Sulawesi|Bali|Papua|NTB|NTT)',
        # Provinsi langsung
        r'di\s+([A-Z][a-z]+\s+(?:Barat|Timur|Tengah|Selatan|Utara|Tenggara))',
    ]

    kata_bukan_lokasi = ['yang', 'dan', 'atau', 'dengan', 'untuk', 'karena', 'bahwa']

    for pattern in patterns:
        match = re.search(pattern, teks[:800])
        if match:
            lokasi = match.group(1).strip()
            if not any(k in lokasi.lower() for k in kata_bukan_lokasi):
                if 3 < len(lokasi) < 50:
                    return lokasi
    return ""

# UTILITY
def bersihkan_teks(teks):
    noise = [
        'ADVERTISEMENT', 'SCROLL TO RESUME CONTENT',
        'Baca juga:', 'Simak Video', 'Lihat juga:',
        'NEXT ARTICLE', 'Artikel ini telah tayang',
    ]
    for n in noise:
        teks = teks.replace(n, ' ')
    return re.sub(r'\s+', ' ', teks).strip()

# AMBIL KONTEN ARTIKEL
# Selector dikonfirmasi dari DevTools
def ambil_konten_artikel(url, session):
    try:
        time.sleep(random.uniform(DELAY_MIN, DELAY_MAX))
        resp = session.get(url, headers=HEADERS, timeout=12)

        if resp.status_code != 200:
            return None

        soup = BeautifulSoup(resp.text, 'lxml')

        # Judul: h1.detail__title
        judul_tag = soup.find('h1', class_='detail__title')
        if not judul_tag:
            return None
        judul = judul_tag.get_text(strip=True)
        if not judul:
            return None

        # Tanggal: div.detail__date
        tanggal = ""
        tanggal_tag = soup.find('div', class_='detail__date')
        if tanggal_tag:
            tanggal = tanggal_tag.get_text(strip=True)
            tanggal = tanggal.replace('WIB','').replace('WITA','').replace('WIT','').strip()

        # Isi: div.detail__body-text > p
        body = soup.find('div', class_='detail__body-text')
        if not body:
            return None

        paragraphs = body.find_all('p')
        isi_parts = []
        for p in paragraphs[:7]:
            teks = bersihkan_teks(p.get_text(strip=True))
            if (teks and len(teks) > 40 and
                not any(n in teks for n in [
                    'ADVERTISEMENT', 'Baca juga', 'Simak Video', 'Lihat juga'
                ])):
                isi_parts.append(teks)

        deskripsi = ' '.join(isi_parts)
        if len(deskripsi) < 100:
            return None

        # Filter relevansi
        if not is_relevan(judul, deskripsi):
            return None

        # Ekstrak lokasi
        lokasi = ekstrak_lokasi(deskripsi)

        return {
            'judul_berita'      : judul,
            'deskripsi_kejadian': deskripsi,
            'lokasi_kejadian'   : lokasi,
            'waktu_kejadian'    : tanggal,
        }

    except Exception:
        return None

# SCRAPE SATU KEYWORD
def scrape_keyword(query, label_urgensi, kategori, max_pages, session):
    hasil = []
    url_seen = set()

    print(f"\n{'='*58}")
    print(f"🔍 [{label_urgensi}] '{query}' → {kategori}")
    print(f"{'='*58}")

    for page in range(1, max_pages + 1):
        search_url = (
            f"https://www.detik.com/search/searchnews"
            f"?query={quote(query)}&sortby=time&page={page}"
        )

        try:
            time.sleep(random.uniform(DELAY_MIN, DELAY_MAX))
            resp = session.get(search_url, headers=HEADERS, timeout=12)

            if resp.status_code != 200:
                print(f"  ⚠️  Hal {page}: HTTP {resp.status_code}")
                continue

            soup = BeautifulSoup(resp.text, 'lxml')

            # Container: div.list-content (dikonfirmasi)
            container = soup.find('div', class_='list-content')
            if not container:
                print(f"  ⚠️  Hal {page}: div.list-content tidak ditemukan, stop")
                break

            # Artikel: article.list-content__item (dikonfirmasi)
            articles = container.find_all('article', class_='list-content__item')
            if not articles:
                print(f"  ⚠️  Hal {page}: Tidak ada artikel, stop")
                break

            print(f"  📄 Hal {page}: {len(articles)} artikel", end="")

            page_ok = 0
            for article in articles:
                # URL: h3.media__title > a[href] (dikonfirmasi)
                h3 = article.find('h3', class_='media__title')
                if not h3:
                    continue

                a_tag = h3.find('a', href=True)
                if not a_tag:
                    continue

                url_artikel = a_tag['href']

                if not url_artikel.startswith('http'):
                    continue
                if 'detik.com' not in url_artikel:
                    continue
                if url_artikel in url_seen:
                    continue

                skip_path = ['/tag/', '/kategori/', '/search/', '/foto/', '/video/']
                if any(p in url_artikel for p in skip_path):
                    continue

                url_seen.add(url_artikel)

                konten = ambil_konten_artikel(url_artikel, session)
                if not konten:
                    continue

                hasil.append({
                    'judul_berita'      : konten['judul_berita'],
                    'deskripsi_kejadian': konten['deskripsi_kejadian'],
                    'lokasi_kejadian'   : konten['lokasi_kejadian'],
                    'waktu_kejadian'    : konten['waktu_kejadian'],
                    'kategori_kejahatan': kategori,
                    'label_urgensi'     : label_urgensi,
                    'sumber'            : 'detik.com',
                    'url'               : url_artikel,
                    'scraped_at'        : datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                })
                page_ok += 1

            print(f" → {page_ok} valid")

        except Exception as e:
            print(f"  ⚠️  Error hal {page}: {e}")
            continue

    print(f"  ✅ Total '{query}': {len(hasil)} artikel")
    return hasil

# SIMPAN CSV
def simpan_csv(data, filename):
    if not data:
        return 0

    fieldnames = [
        'id', 'judul_berita', 'deskripsi_kejadian',
        'lokasi_kejadian', 'waktu_kejadian',
        'kategori_kejahatan', 'label_urgensi',
        'sumber', 'url', 'scraped_at'
    ]

    file_exists = os.path.exists(filename) and os.path.getsize(filename) > 0

    start_id = 1
    if file_exists:
        with open(filename, 'r', encoding='utf-8') as f:
            rows = list(csv.DictReader(f))
            if rows:
                try:
                    start_id = int(rows[-1]['id']) + 1
                except Exception:
                    start_id = len(rows) + 1

    with open(filename, 'a' if file_exists else 'w',
              newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        if not file_exists:
            writer.writeheader()
        for i, row in enumerate(data):
            row['id'] = start_id + i
            writer.writerow(row)

    print(f"  💾 {len(data)} baris disimpan → {filename}")
    return len(data)

# DEDUPLIKASI
def deduplikasi(filename):
    if not os.path.exists(filename):
        return 0, 0

    with open(filename, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        fieldnames = reader.fieldnames

    seen = set()
    unik = []
    for row in rows:
        url = row.get('url', '').strip()
        if url and url not in seen:
            seen.add(url)
            unik.append(row)

    for i, row in enumerate(unik, 1):
        row['id'] = i

    with open(filename, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(unik)

    return len(rows), len(unik)

# RINGKASAN
def cetak_ringkasan(filename):
    if not os.path.exists(filename):
        return

    from collections import Counter
    with open(filename, 'r', encoding='utf-8') as f:
        rows = list(csv.DictReader(f))

    labels    = Counter(r['label_urgensi']     for r in rows)
    kategori  = Counter(r['kategori_kejahatan'] for r in rows)
    ada_lokasi  = sum(1 for r in rows if r['lokasi_kejadian'])
    ada_tanggal = sum(1 for r in rows if r['waktu_kejadian'])
    panjang   = [len(r['deskripsi_kejadian']) for r in rows if r['deskripsi_kejadian']]

    print("\n" + "="*58)
    print("📊  RINGKASAN DATASET FINAL")
    print("="*58)
    print(f"  Total artikel   : {len(rows)}")
    print(f"  Ada lokasi      : {ada_lokasi} ({ada_lokasi/len(rows)*100:.1f}%)")
    print(f"  Ada tanggal     : {ada_tanggal} ({ada_tanggal/len(rows)*100:.1f}%)")
    if panjang:
        print(f"  Rata-rata desc  : {sum(panjang)//len(panjang)} karakter")

    print("\n  Distribusi Label Urgensi:")
    for lbl in ['Tinggi', 'Sedang', 'Rendah']:
        n = labels.get(lbl, 0)
        bar = '█' * (n // 5)
        print(f"    {lbl:<8}: {n:>4}  {bar}")

    print("\n  Distribusi Kategori:")
    for kat, n in sorted(kategori.items(), key=lambda x: -x[1]):
        print(f"    {kat:<30}: {n}")
    print("="*58)

# MAIN
if __name__ == "__main__":
    print("="*58)
    print("🚔  SCRAPER DATASET KRIMINAL INDONESIA - FINAL")
    print("    Proyek: Portal Pelaporan Tindak Kriminal Terpadu")
    print("="*58)
    print(f"  Output    : {OUTPUT_FILE}")
    print(f"  Keywords  : {len(QUERIES)}")
    print(f"  Max hal   : {MAX_PAGES} per keyword")
    print(f"  Estimasi  : 3-4 jam")
    print("="*58)

    session = requests.Session()
    session.headers.update(HEADERS)

    total = 0

    for i, (query, label, kategori) in enumerate(QUERIES, 1):
        print(f"\n[{i}/{len(QUERIES)}]", end=" ")
        hasil = scrape_keyword(query, label, kategori, MAX_PAGES, session)

        if hasil:
            saved = simpan_csv(hasil, OUTPUT_FILE)
            total += saved

        if i < len(QUERIES):
            jeda = random.randint(KEYWORD_DELAY, KEYWORD_DELAY + 5)
            print(f"\n⏳ Jeda {jeda} detik...")
            time.sleep(jeda)

    # Post-processing
    print("\n🔄 Deduplikasi...")
    sebelum, sesudah = deduplikasi(OUTPUT_FILE)
    print(f"  Duplikat dihapus: {sebelum - sesudah}")
    print(f"  Artikel unik    : {sesudah}")

    cetak_ringkasan(OUTPUT_FILE)
    print(f"\n✅ SELESAI → {OUTPUT_FILE}")
