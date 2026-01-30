<script setup lang="ts">
const route = useRoute();
const { user, hasRole } = useAuth();

// Get the reason from query params
const reason = computed(() => route.query.reason as string | undefined);
const requiredRoles = computed(() => {
  const roles = route.query.required as string | undefined;
  return roles ? roles.split(",") : [];
});

// Determine the message based on reason
const message = computed(() => {
  if (reason.value === "role") {
    return `This page requires one of the following roles: ${requiredRoles.value.join(", ")}`;
  }
  if (reason.value === "permission") {
    return "You don't have the required permissions to access this page.";
  }
  return "You are not authorized to access this page.";
});

definePageMeta({
  layout: false,
});
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
    <div class="max-w-md w-full">
      <UPageCard
        title="Access Denied"
        description=""
        icon="i-lucide-shield-x"
        :ui="{
          leading: 'p-4 rounded-full bg-error/10 ring ring-inset ring-error/25'
        }"
      >
        <UAlert
          color="error"
          variant="subtle"
          :title="message"
          icon="i-lucide-alert-circle"
          class="mb-6"
        />

        <div class="mb-6">
          <p class="text-sm text-dimmed mb-2">Your current roles:</p>
          <div class="flex flex-wrap gap-2">
            <UBadge
              v-for="role in user?.roles"
              :key="`${role.name}-${role.storeCode}`"
              color="neutral"
              variant="subtle"
            >
              {{ role.name }}
              <span v-if="role.storeCode" class="ml-1 opacity-75">
                ({{ role.storeCode }})
              </span>
            </UBadge>
            <UBadge v-if="!user?.roles?.length" color="neutral" variant="subtle">
              No roles assigned
            </UBadge>
          </div>
        </div>

        <div class="flex flex-col sm:flex-row gap-3">
          <UButton to="/" variant="solid" block icon="i-lucide-home">
            Go to Dashboard
          </UButton>
          <UButton to="/login" color="neutral" variant="outline" block icon="i-lucide-log-in">
            Switch Account
          </UButton>
        </div>
      </UPageCard>
    </div>
  </div>
</template>
