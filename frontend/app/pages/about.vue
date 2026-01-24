<script setup lang="ts">
definePageMeta({
  layout: false,
});

useHead({
  title: "About & Disclaimer - TikTok Hubs",
});
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
    <div class="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-3xl font-bold mb-4">About TikTok Hubs</h1>
        <p class="text-lg text-gray-600 dark:text-gray-400">
          Official Information & Legitimacy Statement
        </p>
      </div>

      <!-- Important Notice -->
      <div class="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-6 mb-8">
        <h2 class="text-xl font-bold text-blue-900 dark:text-blue-100 mb-2">
          ⚠️ Important Notice
        </h2>
        <p class="text-blue-800 dark:text-blue-200">
          <strong>This is NOT a phishing site.</strong> TikTok Hubs is a legitimate business management platform
          designed for TikTok Shop sellers to manage their stores efficiently.
        </p>
      </div>

      <!-- What is TikTok Hubs -->
      <section class="mb-8">
        <h2 class="text-2xl font-bold mb-4">What is TikTok Hubs?</h2>
        <p class="text-gray-700 dark:text-gray-300 mb-4">
          TikTok Hubs is a <strong>third-party business management platform</strong> that helps TikTok Shop sellers:
        </p>
        <ul class="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 ml-4">
          <li>Manage multiple TikTok Shop accounts from one dashboard</li>
          <li>Track analytics and performance metrics</li>
          <li>Synchronize data from TikTok's official API</li>
          <li>Monitor follower growth and engagement</li>
          <li>Analyze video performance across stores</li>
        </ul>
      </section>

      <!-- Legitimacy -->
      <section class="mb-8">
        <h2 class="text-2xl font-bold mb-4">Legitimacy & Transparency</h2>
        
        <div class="space-y-4 text-gray-700 dark:text-gray-300">
          <div>
            <h3 class="font-semibold text-lg mb-2">✅ We ARE:</h3>
            <ul class="list-disc list-inside ml-4 space-y-1">
              <li>A legitimate business tool for TikTok Shop sellers</li>
              <li>Using TikTok's official API with proper authentication</li>
              <li>Open-source software (check our GitHub repository)</li>
              <li>Compliant with data protection regulations</li>
              <li>Transparent about our operations and purpose</li>
            </ul>
          </div>

          <div>
            <h3 class="font-semibold text-lg mb-2">❌ We are NOT:</h3>
            <ul class="list-disc list-inside ml-4 space-y-1">
              <li>Affiliated with or endorsed by TikTok/ByteDance</li>
              <li>A phishing site attempting to steal credentials</li>
              <li>Selling or sharing user data to third parties</li>
              <li>An unofficial or unauthorized TikTok service</li>
              <li>Attempting to impersonate TikTok's official platform</li>
            </ul>
          </div>
        </div>
      </section>

      <!-- How It Works -->
      <section class="mb-8">
        <h2 class="text-2xl font-bold mb-4">How TikTok Hubs Works</h2>
        <ol class="list-decimal list-inside space-y-3 text-gray-700 dark:text-gray-300 ml-4">
          <li>
            <strong>OAuth Authentication:</strong> We use TikTok's official OAuth 2.0 protocol.
            You authenticate directly with TikTok, not with us.
          </li>
          <li>
            <strong>API Access:</strong> After authentication, TikTok provides us with limited API access
            to read your store analytics (we cannot modify your account).
          </li>
          <li>
            <strong>Data Storage:</strong> We store analytics data locally to provide historical insights
            and trend analysis. Your TikTok password is NEVER stored.
          </li>
          <li>
            <strong>Synchronization:</strong> We periodically sync data from TikTok's API to keep
            your dashboard up-to-date.
          </li>
        </ol>
      </section>

      <!-- Security & Privacy -->
      <section class="mb-8">
        <h2 class="text-2xl font-bold mb-4">Security & Privacy</h2>
        
        <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6 mb-4">
          <h3 class="font-semibold text-lg mb-3 text-green-900 dark:text-green-100">
            🔒 We Protect Your Data
          </h3>
          <ul class="space-y-2 text-green-800 dark:text-green-200">
            <li>✓ All data transmitted over encrypted HTTPS connections</li>
            <li>✓ JWT-based authentication with secure token rotation</li>
            <li>✓ Role-based access control for team management</li>
            <li>✓ Regular security audits and updates</li>
            <li>✓ Audit logs for all administrative actions</li>
            <li>✓ No password storage - OAuth only</li>
          </ul>
        </div>

        <p class="text-gray-700 dark:text-gray-300">
          <strong>Privacy Policy:</strong> We only collect data necessary to provide our service.
          We do not sell, rent, or share your data with third parties for marketing purposes.
        </p>
      </section>

      <!-- Contact & Verification -->
      <section class="mb-8">
        <h2 class="text-2xl font-bold mb-4">Contact & Verification</h2>
        
        <div class="grid md:grid-cols-2 gap-6">
          <div class="border dark:border-gray-700 rounded-lg p-4">
            <h3 class="font-semibold mb-2">📧 Contact Us</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
              For questions or security concerns:
            </p>
            <p class="text-sm">
              Email: <a href="mailto:security@tiktok-hubs.com" class="text-blue-600 hover:underline">
                security@tiktok-hubs.com
              </a>
            </p>
          </div>

          <div class="border dark:border-gray-700 rounded-lg p-4">
            <h3 class="font-semibold mb-2">💻 Source Code</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Verify our legitimacy:
            </p>
            <p class="text-sm">
              GitHub: <a 
                href="https://github.com/muhrobby/tiktok-hubs" 
                target="_blank"
                rel="noopener noreferrer"
                class="text-blue-600 hover:underline"
              >
                github.com/muhrobby/tiktok-hubs
              </a>
            </p>
          </div>
        </div>
      </section>

      <!-- Disclaimer -->
      <section class="mb-8">
        <h2 class="text-2xl font-bold mb-4">Disclaimer</h2>
        <div class="text-sm text-gray-600 dark:text-gray-400 space-y-2">
          <p>
            TikTok Hubs is an independent third-party application and is not affiliated with,
            endorsed by, or sponsored by TikTok, ByteDance Ltd., or any of their affiliates.
          </p>
          <p>
            "TikTok" and the TikTok logo are trademarks of ByteDance Ltd. All other trademarks
            are the property of their respective owners.
          </p>
          <p>
            This service is provided "as is" without warranty of any kind. Use at your own risk.
          </p>
          <p class="font-semibold">
            By using this service, you acknowledge that you have read, understood, and agree to
            this disclaimer and our terms of service.
          </p>
        </div>
      </section>

      <!-- Footer -->
      <div class="border-t dark:border-gray-700 pt-6 mt-8">
        <div class="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
          <p>
            Last Updated: January 25, 2026
          </p>
          <div class="flex gap-4">
            <NuxtLink to="/" class="text-blue-600 hover:underline">
              Return to Dashboard
            </NuxtLink>
            <a href="https://github.com/muhrobby/tiktok-hubs" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">
              View on GitHub
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
