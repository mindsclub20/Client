import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * OpenNext configuration for Cloudflare Workers.
 * @see https://opennext.js.org/cloudflare/get-started
 */
export default defineCloudflareConfig({
  // Default R2/KV cache bindings are optional for MAXWEB.
  // Add incremental cache later if needed.
});
