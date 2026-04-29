"""
Test koneksi ke Supabase menggunakan DATABASE_URL dari .env
Jalankan dari root folder project:
    python scripts/test_koneksi.py
"""
import os
import socket
from pathlib import Path

# Load .env manual (tanpa dotenv library)
env_path = Path(__file__).parent.parent / ".env"
if env_path.exists():
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, _, val = line.partition('=')
                os.environ.setdefault(key.strip(), val.strip())

DATABASE_URL = os.environ.get("DATABASE_URL", "")

if not DATABASE_URL:
    print("❌ DATABASE_URL tidak ditemukan di .env")
    exit(1)

print(f"DATABASE_URL: {DATABASE_URL[:60]}...")

# Parse host dan port dari URL
try:
    after_at = DATABASE_URL.split("@")[1]
    host_port = after_at.split("/")[0]
    if ":" in host_port:
        host, port = host_port.rsplit(":", 1)
        port = int(port)
    else:
        host = host_port
        port = 5432
except Exception as e:
    print(f"❌ Gagal parse DATABASE_URL: {e}")
    exit(1)

print(f"Host: {host}")
print(f"Port: {port}")
print()
print(f"Testing koneksi...")

try:
    socket.setdefaulttimeout(8)
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    result = sock.connect_ex((host, port))
    sock.close()
    if result == 0:
        print("✅ Koneksi berhasil! Lanjutkan migration.")
    else:
        print(f"❌ Port tertutup (code: {result})")
except socket.timeout:
    print("❌ TIMEOUT - jaringan terlalu lambat atau port diblokir")
except socket.gaierror as e:
    print(f"❌ DNS ERROR - {e}")
    print("   Pastikan DATABASE_URL sudah menggunakan Session Pooler URL")
except Exception as e:
    print(f"❌ ERROR - {e}")
