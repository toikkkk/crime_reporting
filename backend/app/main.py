"""
main.py — Entry point FastAPI
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings

app = FastAPI(
    title="Crime Reporting API",
    description="Portal Pelaporan Tindak Kriminal Terpadu — Backend API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers (akan ditambah bertahap) ─────────────────────────────
# from app.api.routes import laporan, auth, admin, predict
# app.include_router(laporan.router, prefix="/api/v1/laporan", tags=["Laporan"])
# app.include_router(predict.router, prefix="/api/v1/predict", tags=["ML Predict"])
# app.include_router(auth.router,    prefix="/api/v1/auth",    tags=["Auth"])
# app.include_router(admin.router,   prefix="/api/v1/admin",   tags=["Admin"])


@app.get("/", tags=["Health"])
async def root():
    return {"status": "ok", "message": "Crime Reporting API is running"}


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "healthy", "version": "1.0.0"}
