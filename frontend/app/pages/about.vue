<script setup lang="ts">
definePageMeta({
  layout: false,
});

useHead({
  title: "About & Disclaimer - Sosmed HUB",
});
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
    <div class="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-3xl font-bold mb-4">About Sosmed HUB</h1>
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
          <strong>This is NOT a phishing site.</strong> Sosmed HUB is a legitimate business management platform
          designed for social media professionals to manage their accounts efficiently.
        </p>
      </div>

      <!-- What is Sosmed HUB -->
      <section class="mb-8">
        <h2 class="text-2xl font-bold mb-4">What is Sosmed HUB?</h2>
        <p class="text-gray-700 dark:text-gray-300 mb-4">
          Sosmed HUB is a <strong>third-party social media management platform</strong> that helps businesses and social media managers:
        </p>
        <ul class="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 ml-4">
          <li>Manage multiple social media accounts from one centralized dashboard</li>
          <li>Track analytics and performance metrics across platforms</li>
          <li>Synchronize data from social media platform APIs</li>
          <li>Monitor follower growth and audience engagement</li>
          <li>Analyze content performance and trends</li>
        </ul>
      </section>

      <!-- Legitimacy -->
      <section class="mb-8">
        <h2 class="text-2xl font-bold mb-4">Legitimacy & Transparency</h2>
        
        <div class="space-y-4 text-gray-700 dark:text-gray-300">
          <div>
            <h3 class="font-semibold text-lg mb-2">✅ We ARE:</h3>
            <ul class="list-disc list-inside ml-4 space-y-1">
              <li>A legitimate business tool for social media management</li>
              <li>Using official platform APIs with proper authentication</li>
              <li>Open-source software (check our GitHub repository)</li>
              <li>Compliant with data protection regulations</li>
              <li>Transparent about our operations and purpose</li>
            </ul>
          </div>

          <div>
            <h3 class="font-semibold text-lg mb-2">❌ We are NOT:</h3>
            <ul class="list-disc list-inside ml-4 space-y-1">
              <li>Affiliated with or endorsed by any major social media platform</li>
              <li>A phishing site attempting to steal credentials</li>
              <li>Selling or sharing user data to third parties</li>
              <li>An unofficial or unauthorized service</li>
              <li>Attempting to impersonate any official platform</li>
            </ul>
          </div>
        </div>
      </section>

      <!-- How It Works -->
      <section class="mb-8">
        <h2 class="text-2xl font-bold mb-4">How Sosmed HUB Works</h2>
        <ol class="list-decimal list-inside space-y-3 text-gray-700 dark:text-gray-300 ml-4">
          <li>
            <strong>OAuth Authentication:</strong> We use official OAuth 2.0 protocol from social media platforms.
            You authenticate directly with the platform, not with us.
          </li>
          <li>
            <strong>API Access:</strong> After authentication, platforms provide us with limited API access
            to read your account analytics (we cannot modify your account).
          </li>
          <li>
            <strong>Data Storage:</strong> We store analytics data locally to provide historical insights
            and trend analysis. Your platform passwords are NEVER stored.
          </li>
          <li>
            <strong>Synchronization:</strong> We periodically sync data from platform APIs to keep
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

      <!-- Brand Disclaimer -->
      <section class="mb-8">
        <h2 class="text-2xl font-bold mb-4">Brand & Trademark Notice</h2>
        <div class="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 p-6">
          <p class="text-yellow-900 dark:text-yellow-100 mb-3">
            <strong>Important:</strong> Sosmed HUB is an independent third-party service.
          </p>
          <ul class="space-y-2 text-yellow-800 dark:text-yellow-200 text-sm">
            <li>• We are NOT affiliated with, endorsed by, or sponsored by any social media platform</li>
            <li>• All trademarks and brand names mentioned belong to their respective owners</li>
            <li>• We use platform APIs under their developer terms and conditions</li>
            <li>• This is a business management tool, not an official platform service</li>
          </ul>
        </div>
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
              Email: <a href="mailto:security@sosmedhub.com" class="text-blue-600 hover:underline">
                security@sosmedhub.com
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
                href="https://github.com/muhrobby/sosmed-hub" 
                target="_blank"
                rel="noopener noreferrer"
                class="text-blue-600 hover:underline"
              >
                github.com/muhrobby/sosmed-hub
              </a>
            </p>
          </div>
        </div>
      </section>

      <!-- Disclaimer -->
      <section class="mb-8">
        <h2 class="text-2xl font-bold mb-4">Legal Disclaimer</h2>
        <div class="text-sm text-gray-600 dark:text-gray-400 space-y-2">
          <p>
            Sosmed HUB is an independent third-party application and is not affiliated with,
            endorsed by, or sponsored by any social media platform or their parent companies.
          </p>
          <p>
            All social media platform names, logos, and trademarks are property of their respective owners.
            Use of these names, logos, and brands does not imply endorsement.
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
            Last Updated: January 28, 2026
          </p>
          <div class="flex gap-4">
            <NuxtLink to="/" class="text-blue-600 hover:underline">
              Return to Dashboard
            </NuxtLink>
            <a href="https://github.com/muhrobby/sosmed-hub" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">
              View on GitHub
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
