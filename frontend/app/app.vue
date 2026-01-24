<script setup lang="ts">
const colorMode = useColorMode();

const color = computed(() =>
  colorMode.value === "dark" ? "#1b1718" : "white",
);

const runtimeConfig = useRuntimeConfig();
const siteUrl = runtimeConfig.public.appUrl || 'https://your-domain.com';

useHead({
  meta: [
    { charset: "utf-8" },
    { name: "viewport", content: "width=device-width, initial-scale=1" },
    { key: "theme-color", name: "theme-color", content: color },
    // Security & Anti-Phishing Meta Tags
    { name: "robots", content: "index, follow" },
    { name: "googlebot", content: "index, follow" },
    { name: "author", content: "TikTok Hubs Team" },
    { name: "publisher", content: "TikTok Hubs" },
    { name: "content-language", content: "en" },
    { name: "revisit-after", content: "7 days" },
    { name: "rating", content: "general" },
    { name: "distribution", content: "global" },
    // Verification Tags (Add your own verification codes when available)
    // { name: "google-site-verification", content: "YOUR_GOOGLE_VERIFICATION_CODE" },
    // { name: "msvalidate.01", content: "YOUR_BING_VERIFICATION_CODE" },
    // Anti-Phishing Tags
    { name: "referrer", content: "strict-origin-when-cross-origin" },
    { "http-equiv": "X-UA-Compatible", content: "IE=edge" },
  ],
  link: [
    { rel: "icon", href: "/favicon.ico" },
    { rel: "canonical", href: siteUrl },
  ],
  htmlAttrs: {
    lang: "en",
  },
});

const title = "TikTok Hubs - Manage Your TikTok Stores";
const description =
  "Official TikTok Hubs platform - Centralized management system for TikTok stores. Track analytics, sync data, and monitor performance across all your TikTok Shop accounts. Legitimate business tool for TikTok Shop sellers.";

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  ogType: "website",
  ogUrl: siteUrl,
  ogSiteName: "TikTok Hubs",
  twitterCard: "summary_large_image",
  twitterTitle: title,
  twitterDescription: description,
  // Add these when you have images
  // ogImage: `${siteUrl}/og-image.png`,
  // twitterImage: `${siteUrl}/twitter-image.png`,
});
</script>

<template>
  <UApp>
    <NuxtLoadingIndicator />

    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
