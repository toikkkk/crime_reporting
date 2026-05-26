import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Backend Config
    ENVIRONMENT: str = "development"
    SECRET_KEY: str = "dev-secret-key-ganti-di-production"

    # Supabase Config (REST API)
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""

    # Supabase Config (PostgreSQL Connection String)
    DATABASE_URL: str = ""

    # MLflow
    MLFLOW_TRACKING_URI: str = "http://localhost:5000"

    class Config:
        env_file = ".env"
        env_file_encoding = 'utf-8'
        extra = "ignore"

# Inisialisasi object settings untuk di-import di file lain
settings = Settings()