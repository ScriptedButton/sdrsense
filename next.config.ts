import type { NextConfig } from "next";

const transformersWeb =
  "./node_modules/@huggingface/transformers/dist/transformers.web.js";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.78"],
  transpilePackages: [
    "@jtarrio/webrtlsdr",
    "@jtarrio/signals",
    "@huggingface/transformers",
    "@e04/ft8ts",
    "three",
  ],
  serverExternalPackages: ["onnxruntime-node", "sharp"],
  turbopack: {
    resolveAlias: {
      // Force browser build — package "node" export pulls onnxruntime-node/wasm assets.
      "@huggingface/transformers": transformersWeb,
    },
  },
};

export default nextConfig;
