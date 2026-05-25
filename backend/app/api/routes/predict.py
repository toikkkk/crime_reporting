from fastapi import APIRouter
from pydantic import BaseModel
from app.ml.predictor import tebak_urgensi_laporan

# Inisialisasi Router khusus untuk fitur AI
router = APIRouter()

# Cetakan form dari frontend
class LaporanRequest(BaseModel):
    teks_laporan: str
    lokasi: str = "Tidak diketahui"

# Rute URL akan menjadi: POST /api/v1/predict/
@router.post("/")
def prediksi_laporan_warga(laporan: LaporanRequest):
    # Panggil fungsi AI
    hasil_urgensi = tebak_urgensi_laporan(laporan.teks_laporan)
    
    return {
        "status": "sukses",
        "pesan": "Teks berhasil dianalisis",
        "data": {
            "laporan_asli": laporan.teks_laporan,
            "prediksi_urgensi": hasil_urgensi
        }
    }