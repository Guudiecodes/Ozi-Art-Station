/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // Server-only packages used to build low-res previews of paid files.
  serverExternalPackages: ["sharp", "@gltf-transform/core", "@gltf-transform/extensions", "@gltf-transform/functions", "meshoptimizer"],
};
export default nextConfig;
