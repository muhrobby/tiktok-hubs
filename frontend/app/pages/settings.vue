<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

// Auth protection
definePageMeta({
  middleware: "auth",
});

const links = [[{
  label: 'General',
  icon: 'i-lucide-user',
  to: '/settings',
  exact: true
}, {
  label: 'Security',
  icon: 'i-lucide-shield',
  to: '/settings/security'
}]] satisfies NavigationMenuItem[][]
</script>

<template>
  <div id="settings">
    <!-- Header -->
    <UDashboardNavbar title="Settings">
      <template #leading>
        <UDashboardSidebarCollapse />
      </template>
    </UDashboardNavbar>

    <UDashboardToolbar>
      <!-- NOTE: The `-mx-1` class is used to align with the `DashboardSidebarCollapse` button here. -->
      <UNavigationMenu :items="links" highlight class="-mx-1 flex-1" />
    </UDashboardToolbar>

    <!-- Body -->
    <div class="p-4 sm:p-6 lg:py-12">
      <div class="flex flex-col gap-4 sm:gap-6 lg:gap-12 w-full lg:max-w-2xl mx-auto">
        <NuxtPage />
      </div>
    </div>
  </div>
</template>
