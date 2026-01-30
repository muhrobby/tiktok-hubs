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
    <div class="max-w-4xl mx-auto">
      <UPageCard
        title="About Sosmed HUB"
        description="Official Information & Legitimacy Statement"
        class="mb-6"
      >
        <!-- Important Notice -->
        <UAlert
          color="primary"
          variant="subtle"
          icon="i-lucide-alert-circle"
          title="Important Notice"
          class="mb-8"
        >
          <template #description>
            <strong>This is NOT a phishing site.</strong> Sosmed HUB is a legitimate business management platform
            designed for social media professionals to manage their accounts efficiently.
          </template>
        </UAlert>

        <!-- What is Sosmed HUB -->
        <UPageSection
          title="What is Sosmed HUB?"
          class="mb-8"
        >
          <p class="mb-4">
            Sosmed HUB is a <strong>third-party social media management platform</strong> that helps businesses and social media managers:
          </p>
          <ul class="list-disc list-inside space-y-2 ml-4">
            <li>Manage multiple social media accounts from one centralized dashboard</li>
            <li>Track analytics and performance metrics across platforms</li>
            <li>Synchronize data from social media platform APIs</li>
            <li>Monitor follower growth and audience engagement</li>
            <li>Analyze content performance and trends</li>
          </ul>
        </UPageSection>

        <!-- Legitimacy -->
        <UPageSection
          title="Legitimacy & Transparency"
          class="mb-8"
        >
          <div class="space-y-6">
            <div>
              <h3 class="font-semibold text-lg mb-3 flex items-center gap-2">
                <UIcon name="i-lucide-check-circle" class="text-green-600" />
                We ARE:
              </h3>
              <ul class="list-disc list-inside ml-4 space-y-1">
                <li>A legitimate business tool for social media management</li>
                <li>Using official platform APIs with proper authentication</li>
                <li>Open-source software (check our GitHub repository)</li>
                <li>Compliant with data protection regulations</li>
                <li>Transparent about our operations and purpose</li>
              </ul>
            </div>

            <div>
              <h3 class="font-semibold text-lg mb-3 flex items-center gap-2">
                <UIcon name="i-lucide-x-circle" class="text-red-600" />
                We are NOT:
              </h3>
              <ul class="list-disc list-inside ml-4 space-y-1">
                <li>Affiliated with or endorsed by any major social media platform</li>
                <li>A phishing site attempting to steal credentials</li>
                <li>Selling or sharing user data to third parties</li>
                <li>An unofficial or unauthorized service</li>
                <li>Attempting to impersonate any official platform</li>
              </ul>
            </div>
          </div>
        </UPageSection>

        <!-- How It Works -->
        <UPageSection
          title="How Sosmed HUB Works"
          class="mb-8"
        >
          <ol class="list-decimal list-inside space-y-3 ml-4">
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
        </UPageSection>

        <!-- Security & Privacy -->
        <UPageSection
          title="Security & Privacy"
          class="mb-8"
        >
          <UAlert
            color="success"
            variant="subtle"
            icon="i-lucide-shield-check"
            title="We Protect Your Data"
            class="mb-4"
          >
            <template #description>
              <ul class="space-y-2 mt-2">
                <li class="flex items-center gap-2">
                  <UIcon name="i-lucide-check" />
                  All data transmitted over encrypted HTTPS connections
                </li>
                <li class="flex items-center gap-2">
                  <UIcon name="i-lucide-check" />
                  JWT-based authentication with secure token rotation
                </li>
                <li class="flex items-center gap-2">
                  <UIcon name="i-lucide-check" />
                  Role-based access control for team management
                </li>
                <li class="flex items-center gap-2">
                  <UIcon name="i-lucide-check" />
                  Regular security audits and updates
                </li>
                <li class="flex items-center gap-2">
                  <UIcon name="i-lucide-check" />
                  Audit logs for all administrative actions
                </li>
                <li class="flex items-center gap-2">
                  <UIcon name="i-lucide-check" />
                  No password storage - OAuth only
                </li>
              </ul>
            </template>
          </UAlert>

          <p>
            <strong>Privacy Policy:</strong> We only collect data necessary to provide our service.
            We do not sell, rent, or share your data with third parties for marketing purposes.
          </p>
        </UPageSection>

        <!-- Brand Disclaimer -->
        <UPageSection
          title="Brand & Trademark Notice"
          class="mb-8"
        >
          <UAlert
            color="warning"
            variant="subtle"
            icon="i-lucide-alert-triangle"
            title="Important: Sosmed HUB is an independent third-party service"
            class="mb-4"
          >
            <template #description>
              <ul class="space-y-2 mt-2">
                <li>• We are NOT affiliated with, endorsed by, or sponsored by any social media platform</li>
                <li>• All trademarks and brand names mentioned belong to their respective owners</li>
                <li>• We use platform APIs under their developer terms and conditions</li>
                <li>• This is a business management tool, not an official platform service</li>
              </ul>
            </template>
          </UAlert>
        </UPageSection>

        <!-- Contact & Verification -->
        <UPageSection
          title="Contact & Verification"
          class="mb-8"
        >
          <div class="grid md:grid-cols-2 gap-6">
            <UCard>
              <template #header>
                <h3 class="font-semibold flex items-center gap-2">
                  <UIcon name="i-lucide-mail" />
                  Contact Us
                </h3>
              </template>
              <p class="text-sm text-dimmed mb-2">
                For questions or security concerns:
              </p>
              <ULink
                to="mailto:security@sosmedhub.com"
                class="text-sm"
              >
                security@sosmedhub.com
              </ULink>
            </UCard>

            <UCard>
              <template #header>
                <h3 class="font-semibold flex items-center gap-2">
                  <UIcon name="i-lucide-github" />
                  Source Code
                </h3>
              </template>
              <p class="text-sm text-dimmed mb-2">
                Verify our legitimacy:
              </p>
              <ULink
                to="https://github.com/muhrobby/sosmed-hub"
                target="_blank"
                class="text-sm"
              >
                github.com/muhrobby/sosmed-hub
              </ULink>
            </UCard>
          </div>
        </UPageSection>

        <!-- Disclaimer -->
        <UPageSection
          title="Legal Disclaimer"
        >
          <div class="text-sm text-dimmed space-y-2">
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
            <p class="font-semibold text-foreground">
              By using this service, you acknowledge that you have read, understood, and agree to
              this disclaimer and our terms of service.
            </p>
          </div>
        </UPageSection>

        <!-- Footer -->
        <USeparator class="my-8" />
        
        <div class="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-dimmed">
          <p>
            Last Updated: January 28, 2026
          </p>
          <div class="flex gap-4">
            <UButton
              to="/"
              variant="link"
              label="Return to Dashboard"
              icon="i-lucide-arrow-left"
            />
            <UButton
              to="https://github.com/muhrobby/sosmed-hub"
              target="_blank"
              variant="link"
              label="View on GitHub"
              icon="i-lucide-github"
              trailing
            />
          </div>
        </div>
      </UPageCard>
    </div>
  </div>
</template>
