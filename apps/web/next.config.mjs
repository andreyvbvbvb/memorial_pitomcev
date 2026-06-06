const internalApiUrl = process.env.INTERNAL_API_URL?.trim() || "http://api:3001";

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${internalApiUrl}/:path*`
      },
      {
        source: "/uploads/:path*",
        destination: `${internalApiUrl}/uploads/:path*`
      }
    ];
  }
};

export default nextConfig;
