import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SENTRY_DSN: process.env.SENTRY_DSN ?? "",
  },
  serverExternalPackages: [
    "chromadb",
    "@chroma-core/default-embed",
    "@huggingface/transformers",
  ],
};

export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
  telemetry: false,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
});
