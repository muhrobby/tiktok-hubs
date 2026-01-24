<script setup lang="ts">
/**
 * Login Page
 * Handles user authentication
 */

definePageMeta({
  layout: false, // No sidebar layout for login
});

const auth = useAuth();
const router = useRouter();

// Form state
const form = reactive({
  username: "",
  password: "",
});

const isLoading = ref(false);
const errorMessage = ref("");

// Redirect if already authenticated
onMounted(async () => {
  await auth.initAuth();
  if (auth.isAuthenticated.value) {
    router.push("/");
  }
});

// Handle login
const handleLogin = async () => {
  if (!form.username || !form.password) {
    errorMessage.value = "Please enter username and password";
    return;
  }

  isLoading.value = true;
  errorMessage.value = "";

  const success = await auth.login({
    username: form.username,
    password: form.password,
  });

  isLoading.value = false;

  if (success) {
    // Redirect to intended page or home
    const redirect = useRoute().query.redirect as string;
    router.push(redirect || "/");
  } else {
    errorMessage.value = auth.error.value || "Login failed";
  }
};

// Handle form submit
const onSubmit = (event: Event) => {
  event.preventDefault();
  handleLogin();
};
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-default p-4">
    <UCard class="w-full max-w-md">
      <template #header>
        <div class="text-center">
          <h1 class="text-2xl font-bold text-highlighted">TikTok Hubs</h1>
          <p class="text-sm text-muted mt-1">Sign in to your account</p>
        </div>
      </template>

      <form @submit="onSubmit" class="space-y-4">
        <!-- Error Message -->
        <UAlert
          v-if="errorMessage"
          color="error"
          variant="soft"
          :title="errorMessage"
          icon="i-lucide-alert-circle"
          :close-button="{ icon: 'i-lucide-x', color: 'error', variant: 'link' }"
          @close="errorMessage = ''"
        />

        <!-- Username -->
        <UFormField label="Username" name="username" required class="w-full">
          <UInput
            v-model="form.username"
            placeholder="Enter your username"
            icon="i-lucide-user"
            size="lg"
            autofocus
            :disabled="isLoading"
            class="w-full"
          />
        </UFormField>

        <!-- Password -->
        <UFormField label="Password" name="password" required class="w-full">
          <UInput
            v-model="form.password"
            type="password"
            placeholder="Enter your password"
            icon="i-lucide-lock"
            size="lg"
            :disabled="isLoading"
            class="w-full"
            @keyup.enter="handleLogin"
          />
        </UFormField>

        <!-- Submit Button -->
        <UButton
          type="submit"
          block
          size="lg"
          :loading="isLoading"
          :disabled="isLoading || !form.username || !form.password"
        >
          <template #leading>
            <UIcon v-if="!isLoading" name="i-lucide-log-in" />
          </template>
          {{ isLoading ? "Signing in..." : "Sign in" }}
        </UButton>
      </form>

      <template #footer>
        <p class="text-xs text-center text-muted">
          TikTok Content Reporting Hub
        </p>
      </template>
    </UCard>
  </div>
</template>
