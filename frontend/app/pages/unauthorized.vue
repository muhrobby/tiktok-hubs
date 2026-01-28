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

// Get user's current roles
const userRoles = computed(() => {
  if (!user.value?.roles.length) return "No roles assigned";
  return user.value.roles.map((r) => r.name).join(", ");
});

definePageMeta({
  layout: false,
});
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-default p-4">
    <div class="max-w-md w-full text-center">
      <div class="mb-8">
        <UIcon
          name="i-lucide-shield-x"
          class="text-6xl text-gray-800 dark:text-gray-200 mx-auto mb-4"
        />
        <h1 class="text-2xl font-bold mb-2">Access Denied</h1>
        <p class="text-muted">{{ message }}</p>
      </div>

      <UCard class="mb-6">
        <div class="text-sm">
          <p class="text-muted mb-2">Your current roles:</p>
          <p class="font-medium">{{ userRoles }}</p>
        </div>
      </UCard>

      <div class="flex flex-col sm:flex-row gap-3 justify-center">
        <UButton to="/" color="gray" variant="solid">
          <UIcon name="i-lucide-home" class="mr-2" />
          Go to Dashboard
        </UButton>
        <UButton to="/login" color="neutral" variant="outline">
          <UIcon name="i-lucide-log-in" class="mr-2" />
          Switch Account
        </UButton>
      </div>
    </div>
  </div>
</template>
