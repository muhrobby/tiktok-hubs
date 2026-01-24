/* eslint-disable nuxt/nuxt-config-keys-order */
/// <reference types="node" />
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ["@nuxt/eslint", "@nuxt/ui", "@vueuse/nuxt"],
  css: ["~/assets/css/main.css"],
  devServer: {
    port: 3001,
  },
  devtools: {
    enabled: true,
  },
  runtimeConfig: {
    // Private keys (server-only)
    backendUrl: process.env.BACKEND_URL || "http://localhost:3000",

    // Public keys (exposed to client)
    public: {
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || "",
      apiUrl: process.env.NUXT_PUBLIC_API_URL || "",
      appUrl: process.env.NUXT_PUBLIC_APP_URL || "http://localhost:3002",
      appName: process.env.NUXT_PUBLIC_APP_NAME || "TikTok Hubs",
    },
  },
  routeRules: {
    "/api/**": {
      cors: true,
    },
    // Add security headers to all routes
    "/**": {
      headers: {
        "X-Frame-Options": "SAMEORIGIN",
        "X-Content-Type-Options": "nosniff",
        "X-XSS-Protection": "1; mode=block",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
        // Strict Transport Security (enable in production with HTTPS)
        // "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
      },
    },
  },
  
  // Production optimizations
  nitro: {
    compressPublicAssets: true,
    minify: true,
  },

  // Security headers
  app: {
    head: {
      meta: [
        { name: 'X-Frame-Options', content: 'SAMEORIGIN' },
        { name: 'X-Content-Type-Options', content: 'nosniff' },
        { name: 'X-XSS-Protection', content: '1; mode=block' },
        { name: 'Referrer-Policy', content: 'strict-origin-when-cross-origin' },
      ],
      link: [
        // Google Fonts - Public Sans
        {
          rel: 'preconnect',
          href: 'https://fonts.googleapis.com',
        },
        {
          rel: 'preconnect',
          href: 'https://fonts.gstatic.com',
          crossorigin: 'anonymous',
        },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Public+Sans:wght@300;400;500;600;700&display=swap',
        },
      ],
    },
  },

  compatibilityDate: "2024-07-11",
  eslint: {
    config: {
      stylistic: {
        commaDangle: "never",
        braceStyle: "1tbs",
      },
    },
  },
});
