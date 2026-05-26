from typing import Optional
from supabase import create_client, Client
from app.core.config import settings

supabase: Optional[Client] = None

try:
    if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
        raise ValueError("SUPABASE_URL atau SUPABASE_KEY belum dikonfigurasi di .env")
    supabase = create_client(
        supabase_url=settings.SUPABASE_URL,
        supabase_key=settings.SUPABASE_KEY,
    )
    print("✅ Supabase Client berhasil terhubung!")
except Exception as e:
    print(f"❌ Gagal menghubungkan ke Supabase: {e}")
