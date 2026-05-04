import type { NextConfig } from "next";

// Allow all origins in dev by reading from env or defaulting to local addresses
const allowedDevOrigins = process.env.ALLOWED_DEV_ORIGINS
  ? process.env.ALLOWED_DEV_ORIGINS.split(",")
  : ["127.0.0.1", "localhost"];

const nextConfig: NextConfig = {
  allowedDevOrigins,
};

export default nextConfig;
