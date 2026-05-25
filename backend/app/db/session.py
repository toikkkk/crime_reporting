import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# 1. Mengambil URL database Supabase dari file .env
# Docker-compose otomatis mengalirkan isi .env ke variabel sistem ini
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("! DATABASE_URL tidak ditemukan di environment variables. Pastikan file .env sudah benar.")

# 2. Membuat "Mesin" (Engine) Koneksi
# Engine ini yang bertugas mengatur lalu lintas ketukan pintu ke Supabase
engine = create_engine(DATABASE_URL)

# 3. Membuat Pabrik Sesi (Session Maker)
# Setiap kali ada transaksi data (warga melapor, polisi login), kita akan minta "tiket" dari sini
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 4. Cetakan Dasar untuk Tabel (Model)
Base = declarative_base()

# 5. Fungsi "Dependency" untuk FastAPI
# Fungsi ini yang akan kita panggil di rute API nanti untuk membuka dan menutup koneksi secara otomatis
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()