/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack(config) {
    // yahoo-finance2 v2.14 ESM build imports Deno-only test modules.
    // Stub them out so webpack doesn't fail.
    config.resolve.alias = {
      ...config.resolve.alias,
      '@std/testing/mock': false,
      '@std/testing/bdd': false,
      '@gadicc/fetch-mock-cache/runtimes/deno.ts': false,
      '@gadicc/fetch-mock-cache/stores/fs.ts': false,
    };
    return config;
  },
};
module.exports = nextConfig;
