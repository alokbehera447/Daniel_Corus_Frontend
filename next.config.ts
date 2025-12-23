const nextConfig = {
  output: "standalone",
  images: {
    unoptimized: true   // 🔥 prevents native sharp memory kill
  }
}

export default nextConfig
