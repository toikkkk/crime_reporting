"""
migrate_csv_to_db.py
====================
Script migrasi data dari dataset_siap_training.csv ke PostgreSQL.
Bisa dijalankan ke database lokal (Docker) atau Supabase.

Usage:
    # Local Docker
    python scripts/migrate_csv_to_db.py --env local

    # Supabase Production
    python scripts/migrate_csv_to_db.py --env production
"""

import os
import sys
import argparse
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv
from pathlib import Path

# ── Load .env ──────────────────────────────────────────────────────
ROOT = Path(__file__).parent.parent
load_dotenv(ROOT / ".env")

# ── Config ─────────────────────────────────────────────────────────
DB_CONFIGS = {
    "local": {
        "host": "localhost",
        "port": 5432,
        "dbname": os.getenv("POSTGRES_DB", "crime_reporting"),
        "user": os.getenv("POSTGRES_USER", "crime_user"),
        "password": os.getenv("POSTGRES_PASSWORD", "crime_pass"),
    },
    "production": {
        # Ambil dari DATABASE_URL di .env
        "dsn": os.getenv("DATABASE_URL", ""),
    },
}

CSV_PATH = ROOT / "data" / "dataset_siap_training.csv"


def get_connection(env: str):
    config = DB_CONFIGS[env]
    if env == "production":
        if not config["dsn"]:
            raise ValueError("DATABASE_URL tidak ada di .env")
        return psycopg2.connect(config["dsn"])
    return psycopg2.connect(**config)


def clean_value(val):
    """Konversi NaN pandas ke None (NULL di PostgreSQL)"""
    if pd.isna(val):
        return None
    return val


def migrate(env: str, csv_path: Path, batch_size: int = 500):
    print(f"📂 Membaca CSV: {csv_path}")
    df = pd.read_csv(csv_path)
    print(f"✅ Total rows: {len(df)}")

    # ── Validasi kolom wajib ──────────────────────────────────────
    required_cols = [
        "judul_berita", "deskripsi_kejadian", "kategori_kejahatan",
        "label_urgensi", "label_asal", "deskripsi_original",
        "deskripsi_bersih", "is_synthetic"
    ]
    missing = [c for c in required_cols if c not in df.columns]
    if missing:
        raise ValueError(f"Kolom tidak ditemukan di CSV: {missing}")

    # ── Normalisasi ───────────────────────────────────────────────
    # is_synthetic: "Yes"/"No" → True/False
    df["is_synthetic"] = df["is_synthetic"].str.strip().str.lower() == "yes"

    # label_urgensi dan label_asal: strip whitespace
    df["label_urgensi"] = df["label_urgensi"].str.strip()
    df["label_asal"] = df["label_asal"].str.strip()

    # scraped_at: parse ke timestamp
    df["scraped_at"] = pd.to_datetime(df["scraped_at"], errors="coerce")

    print(f"\n📊 Distribusi label_urgensi:")
    print(df["label_urgensi"].value_counts().to_string())

    print(f"\n📊 Distribusi is_synthetic:")
    print(df["is_synthetic"].value_counts().to_string())

    # ── Koneksi ke database ───────────────────────────────────────
    print(f"\n🔌 Connecting ke database ({env})...")
    conn = get_connection(env)
    cursor = conn.cursor()

    # ── Cek apakah tabel sudah ada data ──────────────────────────
    cursor.execute("SELECT COUNT(*) FROM training_data")
    existing_count = cursor.fetchone()[0]

    if existing_count > 0:
        print(f"⚠️  Tabel training_data sudah ada {existing_count} rows.")
        confirm = input("Lanjut? Data akan di-truncate dulu (y/N): ").strip().lower()
        if confirm != "y":
            print("❌ Migration dibatalkan.")
            conn.close()
            return
        cursor.execute("TRUNCATE TABLE training_data RESTART IDENTITY CASCADE")
        conn.commit()
        print("🗑️  Tabel berhasil di-truncate.")

    # ── Insert data dalam batch ───────────────────────────────────
    INSERT_SQL = """
        INSERT INTO training_data (
            judul_berita, deskripsi_kejadian, lokasi_kejadian,
            waktu_kejadian, kategori_kejahatan, label_urgensi,
            label_asal, sumber, url, scraped_at,
            deskripsi_original, deskripsi_bersih,
            keywords_highlight, is_synthetic
        ) VALUES %s
    """

    total = len(df)
    inserted = 0
    failed = 0

    for start in range(0, total, batch_size):
        batch = df.iloc[start : start + batch_size]
        rows = []

        for _, row in batch.iterrows():
            rows.append((
                clean_value(row["judul_berita"]),
                clean_value(row["deskripsi_kejadian"]),
                clean_value(row.get("lokasi_kejadian")),
                clean_value(row.get("waktu_kejadian")),
                clean_value(row["kategori_kejahatan"]),
                clean_value(row["label_urgensi"]),
                clean_value(row["label_asal"]),
                clean_value(row.get("sumber")),
                clean_value(row.get("url")),
                clean_value(row.get("scraped_at")),
                clean_value(row["deskripsi_original"]),
                clean_value(row["deskripsi_bersih"]),
                clean_value(row.get("keywords_highlight")),
                bool(row["is_synthetic"]),
            ))

        try:
            execute_values(cursor, INSERT_SQL, rows)
            conn.commit()
            inserted += len(rows)
            print(f"  ✅ Inserted {inserted}/{total} rows...", end="\r")
        except Exception as e:
            conn.rollback()
            failed += len(rows)
            print(f"\n  ❌ Batch {start}-{start+batch_size} gagal: {e}")

    # ── Summary ───────────────────────────────────────────────────
    cursor.execute("SELECT COUNT(*) FROM training_data")
    final_count = cursor.fetchone()[0]

    print(f"\n\n{'='*50}")
    print(f"✅ Migration selesai!")
    print(f"   Rows inserted : {inserted}")
    print(f"   Rows failed   : {failed}")
    print(f"   Total di DB   : {final_count}")
    print(f"{'='*50}")

    cursor.close()
    conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate CSV to PostgreSQL")
    parser.add_argument(
        "--env",
        choices=["local", "production"],
        default="local",
        help="Target database environment"
    )
    parser.add_argument(
        "--csv",
        type=str,
        default=str(CSV_PATH),
        help="Path ke file CSV"
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=500,
        help="Jumlah rows per batch insert"
    )
    args = parser.parse_args()

    migrate(
        env=args.env,
        csv_path=Path(args.csv),
        batch_size=args.batch_size
    )
