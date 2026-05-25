import mlflow
from app.core.config import settings

# 1. Mengarahkan antena ke server MLflow
# Server ini adalah tempat menyimpan AI-nya
mlflow.set_tracking_uri(settings.MLFLOW_TRACKING_URI)

def tebak_urgensi_laporan(teks_laporan: str) -> str:
    """
    Fungsi ini bertugas mengirim teks ke model ML
    dan mengembalikan tingkat urgensi (Tinggi, Sedang, atau Rendah).
    """
    try:
        # 2. Mengambil model bernama "PBL" dari map penyimpanan
        # pakai versi 1 sebagai default
        model = mlflow.pyfunc.load_model("models:/PBL/1")
        
        # 3. Menyuruh AI membaca teks dan menebak urgensinya
        hasil_tebakan = model.predict([teks_laporan])
        
        # Mengembalikan jawaban pertama dari AI
        return hasil_tebakan[0]
        
    except Exception as e:
        print(f"⚠️ Gagal menghubungi otak ML: {e}")
        # Fitur Keselamatan: Jika AI sedang mati/error, kita anggap laporan tersebut "Sedang"
        # agar website tidak ikut error/crash.
        return "Sedang"