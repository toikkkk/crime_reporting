/** @type {import('next').NextConfig} */
const nextConfig = {
  // Gunakan konfigurasi ini untuk mendefinisikan root direktori
  // bagi Turbopack agar tidak bingung dengan lockfile di luar
  experimental: {
    // Kosongkan bagian experimental jika tidak ada opsi lain
  },
  
  // Konfigurasi root direktori untuk Turbopack
  // Ini akan memberitahu Turbopack bahwa folder ini adalah root proyek
  turbopack: {
    root: __dirname,
  },
}

module.exports = nextConfig