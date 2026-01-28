<script setup lang="ts">
import type { NavigationMenuItem } from "@nuxt/ui";

const open = ref(false);
const { isAuthenticated, isLoading, isAdminOrOps, isAdmin, canManageUsers } = useAuth();

// Provide sidebar state to child components
provide('sidebar', { open });

// Build navigation links based on user permissions
const links = computed<NavigationMenuItem[][]>(() => {
  // Base navigation items (available to all authenticated users)
  const mainLinks: NavigationMenuItem[] = [
    {
      label: "Dashboard",
      icon: "i-lucide-layout-dashboard",
      to: "/",
      onSelect: () => {
        open.value = false;
      },
    },
    {
      label: "Store Accounts",
      icon: "i-lucide-store",
      to: "/tiktok-store-accounts",
      onSelect: () => {
        open.value = false;
      },
    },
  ];

  // Analytics - available to Admin and Ops only
  if (isAdminOrOps.value) {
    mainLinks.push({
      label: "Analytics",
      icon: "i-lucide-bar-chart-3",
      to: "/analytics",
      onSelect: () => {
        open.value = false;
      },
    });
  }

  // Secondary links
  const secondaryLinks: NavigationMenuItem[] = [];

  // User management - Admin only
  if (canManageUsers.value) {
    secondaryLinks.push({
      label: "Users",
      icon: "i-lucide-users",
      to: "/admin/users",
      onSelect: () => {
        open.value = false;
      },
    });
  }

  // Data Management - Admin/Ops only
  if (isAdminOrOps.value) {
    secondaryLinks.push({
      label: "Data",
      icon: "i-lucide-database",
      to: "/admin/data-management",
      onSelect: () => {
        open.value = false;
      },
    });
  }

  // Audit Logs - Admin only
  if (isAdmin.value) {
    secondaryLinks.push({
      label: "Audit Logs",
      icon: "i-lucide-scroll-text",
      to: "/admin/audit-logs",
      onSelect: () => {
        open.value = false;
      },
    });
  }

  return [mainLinks, secondaryLinks];
});
</script>

<template>
  <div v-if="isLoading" class="flex items-center justify-center min-h-screen">
    <UIcon name="i-lucide-loader-2" class="animate-spin text-4xl text-primary" />
  </div>

  <UDashboardGroup v-else-if="isAuthenticated" unit="rem">
    <UDashboardSidebar
      id="default"
      v-model:open="open"
      collapsible
      resizable
      class="bg-elevated/25"
      :ui="{ 
        footer: 'lg:border-t lg:border-default',
        body: 'flex flex-col flex-1 overflow-y-auto',
        content: 'min-h-0',
        base: 'h-screen overflow-hidden'
      }"
    >
      <template #header="{ collapsed }">
        <TeamsMenu :collapsed="collapsed" />
      </template>

      <template #default="{ collapsed }">
        <div class="flex flex-col flex-1 gap-4 overflow-hidden">
          <!-- Main navigation -->
          <UNavigationMenu
            :collapsed="collapsed"
            :items="links[0]"
            orientation="vertical"
            tooltip
            popover
          />

          <!-- Spacer -->
          <div class="flex-1" />

          <!-- Secondary navigation (pinned to bottom) -->
          <UNavigationMenu
            v-if="links[1].length > 0"
            :collapsed="collapsed"
            :items="links[1]"
            orientation="vertical"
            tooltip
          />
        </div>
      </template>

      <template #footer="{ collapsed }">
        <UserMenu :collapsed="collapsed" />
      </template>
    </UDashboardSidebar>

    <!-- Main content area with proper padding and overflow handling -->
    <UDashboardPanel grow class="overflow-x-hidden">
      <slot />
    </UDashboardPanel>

    <NotificationsSlideover />
  </UDashboardGroup>

  <!-- Fallback for unauthenticated (shouldn't happen due to middleware) -->
  <div v-else class="flex items-center justify-center min-h-screen">
    <div class="text-center">
      <p class="mb-4">Please log in to continue</p>
      <UButton to="/login" color="primary">Go to Login</UButton>
    </div>
  </div>
</template>
