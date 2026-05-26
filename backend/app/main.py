import traceback
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from app.ml.preprocessor import jalankan_pipeline_ml
from app.db.client import supabase

load_dotenv()

app = FastAPI(
    title="SIPEDULI API",
    description="Sistem Pelaporan Kejahatan Terpadu dengan AI Risk Scoring",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

<<<<<<< HEAD
# ── Routers (akan ditambah bertahap) ─────────────────────────────
# from app.api.routes import laporan, auth, admin, predict
from app.api.routes import predict
# app.include_router(laporan.router, prefix="/api/v1/laporan", tags=["Laporan"])
app.include_router(predict.router, prefix="/api/v1/predict", tags=["ML Predict"])
# app.include_router(auth.router,    prefix="/api/v1/auth",    tags=["Auth"])
# app.include_router(admin.router,   prefix="/api/v1/admin",   tags=["Admin"])
=======

class LaporanBaru(BaseModel):
    judul: str
    deskripsi: str
    lokasi: str
    nama_pelapor: Optional[str] = None
    kontak_pelapor: Optional[str] = None
    is_anonim: bool = False
>>>>>>> 8aea4730 (connection ke backend)


class StatusUpdate(BaseModel):
    status: str


@app.get("/")
def read_root():
    return {"message": "SIPEDULI Backend is running!"}


@app.post("/api/laporan")
async def buat_laporan_baru(laporan: LaporanBaru):
    if not laporan.deskripsi.strip():
        raise HTTPException(status_code=400, detail="Deskripsi tidak boleh kosong")

    if supabase is None:
        raise HTTPException(status_code=503, detail="Database belum terhubung. Periksa konfigurasi .env")

    try:
        # 1. Jalankan pipeline ML — hasilkan risk_score & kategori
        hasil_ai = jalankan_pipeline_ml(laporan.deskripsi)

        # 2. Insert ke Supabase — ticket_id di-generate oleh DB trigger
        data_insert = {
            "judul": laporan.judul,
            "deskripsi": laporan.deskripsi,
            "deskripsi_bersih": hasil_ai["teks_bersih"],
            "lokasi": laporan.lokasi,
            "nama_pelapor": laporan.nama_pelapor,
            "kontak_pelapor": laporan.kontak_pelapor,
            "is_anonim": laporan.is_anonim,
            "prediksi_urgensi": hasil_ai["kategori"],
            "confidence_score": hasil_ai["risk_score"],
            "keywords_detected": hasil_ai["keywords_detected"],
            "status": "Diterima",
        }

        response = supabase.table("laporan").insert(data_insert).execute()
        ticket_id = response.data[0]["ticket_id"]

        return {
            "status": "success",
            "ticket_id": ticket_id,
            "analisis": hasil_ai,
        }

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/laporan")
async def daftar_laporan(limit: int = 100, offset: int = 0):
    if supabase is None:
        raise HTTPException(status_code=503, detail="Database belum terhubung")

    try:
        response = (
            supabase.table("laporan")
            .select("*")
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )

        # Fetch minimal fields for stats aggregation (updated_at for selesai_hari_ini check)
        stats_response = (
            supabase.table("laporan")
            .select("prediksi_urgensi,status,updated_at")
            .execute()
        )
        all_data = stats_response.data
        today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        total = len(all_data)
        tinggi = sum(1 for r in all_data if r.get("prediksi_urgensi") == "Tinggi")
        aktif = sum(1 for r in all_data if r.get("status") not in ("Selesai", "Ditolak"))
        selesai_hari_ini = sum(
            1 for r in all_data
            if r.get("status") == "Selesai" and (r.get("updated_at") or "").startswith(today_str)
        )

        return {
            "data": response.data,
            "stats": {
                "total": total,
                "tinggi": tinggi,
                "aktif": aktif,
                "selesaiHariIni": selesai_hari_ini,
            },
        }

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/laporan/{ticket_id}")
async def get_laporan_by_ticket(ticket_id: str):
    if supabase is None:
        raise HTTPException(status_code=503, detail="Database belum terhubung")
    try:
        response = (
            supabase.table("laporan")
            .select("*")
            .eq("ticket_id", ticket_id.upper())
            .execute()
        )
        if not response.data:
            raise HTTPException(status_code=404, detail=f"Laporan {ticket_id} tidak ditemukan")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/api/laporan/{ticket_id}/status")
async def update_status_laporan(ticket_id: str, body: StatusUpdate):
    if supabase is None:
        raise HTTPException(status_code=503, detail="Database belum terhubung")

    valid = ["Diterima", "Dianalisis", "Dalam Penyelidikan", "Selesai", "Ditolak"]
    if body.status not in valid:
        raise HTTPException(status_code=400, detail=f"Status tidak valid. Pilihan: {valid}")

    try:
        # Verify the ticket exists first
        check = (
            supabase.table("laporan")
            .select("ticket_id")
            .eq("ticket_id", ticket_id)
            .execute()
        )
        if not check.data:
            raise HTTPException(status_code=404, detail=f"Laporan {ticket_id} tidak ditemukan")

        # Do the update — response.data may be empty depending on Supabase config; that's OK
        supabase.table("laporan") \
            .update({"status": body.status}) \
            .eq("ticket_id", ticket_id) \
            .execute()

        return {"status": "success", "ticket_id": ticket_id, "new_status": body.status}

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/laporan/{ticket_id}/foto")
async def upload_foto_bukti(ticket_id: str, files: List[UploadFile] = File(...)):
    if supabase is None:
        raise HTTPException(status_code=503, detail="Database belum terhubung")

    check = supabase.table("laporan").select("id").eq("ticket_id", ticket_id.upper()).execute()
    if not check.data:
        raise HTTPException(status_code=404, detail=f"Laporan {ticket_id} tidak ditemukan")
    laporan_id = check.data[0]["id"]

    BUCKET = "foto-bukti"
    uploaded = []

    for f in files:
        content = await f.read()
        ext = (f.filename or "file").rsplit(".", 1)[-1].lower()
        storage_path = f"{laporan_id}/{uuid.uuid4().hex}.{ext}"

        try:
            supabase.storage.from_(BUCKET).upload(
                path=storage_path,
                file=content,
                file_options={"content-type": f.content_type or "application/octet-stream"},
            )
            public_url = supabase.storage.from_(BUCKET).get_public_url(storage_path)
        except Exception as upload_err:
            print(f"Storage upload gagal ({f.filename}): {upload_err}")
            continue

        supabase.table("foto_bukti").insert({
            "laporan_id":  laporan_id,
            "filename":    f.filename,
            "storage_url": public_url,
            "file_size":   len(content),
            "mime_type":   f.content_type,
        }).execute()
        uploaded.append({"filename": f.filename, "url": public_url})

    return {"status": "success", "ticket_id": ticket_id, "uploaded": uploaded, "count": len(uploaded)}


@app.get("/api/laporan/{ticket_id}/foto")
async def get_foto_bukti(ticket_id: str):
    if supabase is None:
        raise HTTPException(status_code=503, detail="Database belum terhubung")

    check = supabase.table("laporan").select("id").eq("ticket_id", ticket_id.upper()).execute()
    if not check.data:
        raise HTTPException(status_code=404, detail=f"Laporan {ticket_id} tidak ditemukan")
    laporan_id = check.data[0]["id"]

    try:
        response = supabase.table("foto_bukti").select("*").eq("laporan_id", laporan_id).execute()
        return {"data": response.data, "count": len(response.data)}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
