import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const isExport = process.env.NEXT_EXPORT === "1";

const nextConfig = {
  reactCompiler: true,
  output: isExport ? "export" : undefined,
  basePath: isExport ? "/drone-map" : undefined,
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
