import path from "path";
import { fileURLToPath } from "url";

/** @type {import('next').NextConfig} */
const isExport = process.env.NEXT_EXPORT === "1";
const appDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig = {
  reactCompiler: true,
  output: isExport ? "export" : undefined,
  basePath: isExport ? "/drone-map" : undefined,
  // Pin Turbopack workspace root when multiple lockfiles exist (e.g. parent folder),
  // so dependency resolution uses this app's node_modules.
  turbopack: {
    root: appDir,
  },
};

export default nextConfig;
