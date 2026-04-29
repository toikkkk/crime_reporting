-- ================================================================
-- Crime Reporting System - Database Schema
-- PostgreSQL 16
-- ================================================================

-- Extension untuk UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================================
-- ENUM TYPES
-- ================================================================
CREATE TYPE urgensi_level AS ENUM ('Tinggi', 'Sedang', 'Rendah');
CREATE TYPE status_laporan AS ENUM ('Diterima', 'Dianalisis', 'Dalam Penyelidikan', 'Selesai', 'Ditolak');
CREATE TYPE label_asal_type AS ENUM ('Tinggi', 'Sedang', 'Rendah', 'Manual');

-- ================================================================
-- 1. TABEL TRAINING DATA (dari CSV preprocessing)
--    Dipakai untuk: training ML, EDA, clustering
-- ================================================================
CREATE TABLE training_data (
    id                  SERIAL PRIMARY KEY,
    judul_berita        TEXT NOT NULL,
    deskripsi_kejadian  TEXT NOT NULL,
    lokasi_kejadian     TEXT,
    waktu_kejadian      TEXT,
    kategori_kejahatan  VARCHAR(100) NOT NULL,
    label_urgensi       urgensi_level NOT NULL,
    label_asal          label_asal_type NOT NULL,
    sumber              VARCHAR(100),
    url                 TEXT,
    scraped_at          TIMESTAMPTZ,
    deskripsi_original  TEXT NOT NULL,
    deskripsi_bersih    TEXT NOT NULL,
    keywords_highlight  TEXT,
    is_synthetic        BOOLEAN NOT NULL DEFAULT FALSE,
    -- Hasil clustering (diisi setelah model clustering jalan)
    cluster_id          INTEGER,
    cluster_label       VARCHAR(100),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index untuk query ML
CREATE INDEX idx_training_label_urgensi ON training_data(label_urgensi);
CREATE INDEX idx_training_kategori ON training_data(kategori_kejahatan);
CREATE INDEX idx_training_is_synthetic ON training_data(is_synthetic);
CREATE INDEX idx_training_cluster ON training_data(cluster_id);

-- ================================================================
-- 2. TABEL LAPORAN MASYARAKAT (input dari portal pelapor)
-- ================================================================
CREATE TABLE laporan (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- Tracking ticket untuk pelapor
    ticket_id           VARCHAR(12) UNIQUE NOT NULL,  -- contoh: CRM-2024-0001

    -- Input dari pelapor
    judul               VARCHAR(255) NOT NULL,
    deskripsi           TEXT NOT NULL,
    lokasi              TEXT,
    waktu_kejadian      TIMESTAMPTZ,
    kategori_awal       VARCHAR(100),  -- kategori yang dipilih pelapor

    -- Identitas pelapor (opsional, bisa anonim)
    nama_pelapor        VARCHAR(100),
    kontak_pelapor      VARCHAR(100),  -- email atau no HP
    is_anonim           BOOLEAN NOT NULL DEFAULT FALSE,

    -- Hasil prediksi ML
    prediksi_urgensi    urgensi_level,
    confidence_score    FLOAT,           -- 0.0 - 1.0
    keywords_detected   TEXT[],          -- array keywords yang terdeteksi
    deskripsi_bersih    TEXT,            -- setelah preprocessing

    -- Status penanganan
    status              status_laporan NOT NULL DEFAULT 'Diterima',
    catatan_petugas     TEXT,
    petugas_id          UUID,            -- FK ke tabel petugas (nanti)

    -- Metadata
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX idx_laporan_ticket ON laporan(ticket_id);
CREATE INDEX idx_laporan_urgensi ON laporan(prediksi_urgensi);
CREATE INDEX idx_laporan_status ON laporan(status);
CREATE INDEX idx_laporan_created ON laporan(created_at DESC);

-- ================================================================
-- 3. TABEL FOTO BUKTI
-- ================================================================
CREATE TABLE foto_bukti (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    laporan_id      UUID NOT NULL REFERENCES laporan(id) ON DELETE CASCADE,
    filename        VARCHAR(255) NOT NULL,   -- nama file di storage
    storage_url     TEXT NOT NULL,           -- URL Supabase Storage
    file_size       INTEGER,                 -- bytes
    mime_type       VARCHAR(50),
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_foto_laporan ON foto_bukti(laporan_id);

-- ================================================================
-- 4. TABEL PETUGAS / ADMIN
-- ================================================================
CREATE TABLE petugas (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nama        VARCHAR(100) NOT NULL,
    nrp         VARCHAR(20) UNIQUE,          -- Nomor Registrasi Polisi
    email       VARCHAR(150) UNIQUE NOT NULL,
    password    VARCHAR(255) NOT NULL,       -- bcrypt hash
    role        VARCHAR(50) NOT NULL DEFAULT 'petugas',  -- petugas | admin
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================================
-- 5. TABEL ML EXPERIMENTS LOG (ringkasan dari MLflow)
--    Supaya dashboard bisa tampilkan info model tanpa buka MLflow
-- ================================================================
CREATE TABLE ml_models (
    id              SERIAL PRIMARY KEY,
    nama_model      VARCHAR(100) NOT NULL,   -- e.g. "LogisticRegression v1"
    mlflow_run_id   VARCHAR(100) UNIQUE,
    algorithm       VARCHAR(100) NOT NULL,
    accuracy        FLOAT,
    f1_score        FLOAT,
    is_active       BOOLEAN NOT NULL DEFAULT FALSE,  -- model yang dipakai production
    params          JSONB,                           -- hyperparameter
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================================
-- 6. FUNCTION: Auto-generate ticket_id
-- ================================================================
CREATE OR REPLACE FUNCTION generate_ticket_id()
RETURNS TRIGGER AS $$
DECLARE
    year_part   TEXT := TO_CHAR(NOW(), 'YYYY');
    seq_num     INTEGER;
    new_ticket  TEXT;
BEGIN
    SELECT COUNT(*) + 1 INTO seq_num
    FROM laporan
    WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());

    new_ticket := 'CRM-' || year_part || '-' || LPAD(seq_num::TEXT, 4, '0');
    NEW.ticket_id := new_ticket;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generate_ticket
    BEFORE INSERT ON laporan
    FOR EACH ROW
    WHEN (NEW.ticket_id IS NULL OR NEW.ticket_id = '')
    EXECUTE FUNCTION generate_ticket_id();

-- ================================================================
-- 7. FUNCTION: Auto-update updated_at
-- ================================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_laporan_updated_at
    BEFORE UPDATE ON laporan
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ================================================================
-- SEED DATA: Admin default (password: admin123 - ganti di production!)
-- Hash bcrypt dari "admin123"
-- ================================================================
INSERT INTO petugas (nama, nrp, email, password, role)
VALUES (
    'Admin Sistem',
    'ADM-0001',
    'admin@crimereport.id',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TqrZFXLWN1kCNFBz0F1Q1DXxY5Hy',
    'admin'
);
