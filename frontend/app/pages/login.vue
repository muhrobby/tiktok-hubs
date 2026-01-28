<script setup lang="ts">
/**
 * Login Page
 * Handles user authentication with disclaimer
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
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
    <div class="w-full max-w-6xl">
      <div class="grid md:grid-cols-2 gap-0 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
        
        <!-- LEFT SIDE - Disclaimer & Info -->
        <div class="bg-gradient-to-br from-primary-500 to-primary-700 dark:from-primary-600 dark:to-primary-800 p-8 md:p-12 flex flex-col justify-center text-white">
          <!-- Logo & Brand -->
          <div class="mb-8">
            <div class="inline-flex items-center justify-center w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl mb-4">
              <UIcon name="i-lucide-shield-check" class="w-8 h-8" />
            </div>
            <h1 class="text-3xl md:text-4xl font-bold mb-2">Sosmed HUB</h1>
            <p class="text-lg text-primary-100">Social Media Management Platform</p>
          </div>

          <!-- Security Notice -->
          <div class="space-y-6 mb-8">
            <div class="bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-white/20">
              <div class="flex items-start gap-3 mb-3">
                <UIcon name="i-lucide-lock-keyhole" class="w-6 h-6 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 class="font-semibold text-lg mb-1">Your Data is Safe</h3>
                  <p class="text-sm text-primary-100 leading-relaxed">
                    We do <strong>NOT</strong> store your social media passwords. 
                    All authentication is handled through official OAuth protocols.
                  </p>
                </div>
              </div>
            </div>

            <div class="bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-white/20">
              <div class="flex items-start gap-3 mb-3">
                <UIcon name="i-lucide-shield-alert" class="w-6 h-6 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 class="font-semibold text-lg mb-1">Not a Phishing Site</h3>
                  <p class="text-sm text-primary-100 leading-relaxed">
                    This is a legitimate business management platform. We are <strong>NOT</strong> affiliated 
                    with any major social media platform. This is an independent third-party tool.
                  </p>
                </div>
              </div>
            </div>

            <div class="bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-white/20">
              <div class="flex items-start gap-3 mb-3">
                <UIcon name="i-lucide-eye-off" class="w-6 h-6 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 class="font-semibold text-lg mb-1">Privacy Protected</h3>
                  <p class="text-sm text-primary-100 leading-relaxed">
                    We only access analytics data through official APIs. 
                    Your sensitive information is <strong>NEVER</strong> collected or shared.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Additional Info -->
          <div class="space-y-3 text-sm text-primary-100 border-t border-white/20 pt-6">
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-check-circle" class="w-4 h-4" />
              <span>End-to-end encryption</span>
            </div>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-check-circle" class="w-4 h-4" />
              <span>JWT-based authentication</span>
            </div>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-check-circle" class="w-4 h-4" />
              <span>Role-based access control</span>
            </div>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-check-circle" class="w-4 h-4" />
              <span>Regular security audits</span>
            </div>
          </div>

          <!-- Footer Links -->
          <div class="mt-auto pt-8 border-t border-white/20 flex flex-wrap gap-4 text-sm">
            <NuxtLink to="/about" class="hover:underline text-primary-100 hover:text-white transition">
              About & Disclaimer
            </NuxtLink>
            <a href="https://github.com/muhrobby/sosmed-hub" target="_blank" rel="noopener noreferrer" class="hover:underline text-primary-100 hover:text-white transition flex items-center gap-1">
              <UIcon name="i-lucide-github" class="w-4 h-4" />
              GitHub
            </a>
          </div>
        </div>

        <!-- RIGHT SIDE - Login Form -->
        <div class="p-8 md:p-12 flex flex-col justify-center">
          <div class="max-w-md mx-auto w-full">
            <!-- Header -->
            <div class="mb-8">
              <h2 class="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Welcome Back
              </h2>
              <p class="text-gray-600 dark:text-gray-400">
                Sign in to access your dashboard
              </p>
            </div>

            <!-- Login Form -->
            <form @submit="onSubmit" class="space-y-6">
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
                  size="xl"
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
                  size="xl"
                  :disabled="isLoading"
                  class="w-full"
                  @keyup.enter="handleLogin"
                />
              </UFormField>

              <!-- Submit Button -->
              <UButton
                type="submit"
                block
                size="xl"
                :loading="isLoading"
                :disabled="isLoading || !form.username || !form.password"
                class="mt-6"
              >
                <template #leading>
                  <UIcon v-if="!isLoading" name="i-lucide-log-in" />
                </template>
                {{ isLoading ? "Signing in..." : "Sign in" }}
              </UButton>
            </form>

            <!-- Additional Info -->
            <div class="mt-8 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
              <p class="text-xs text-gray-600 dark:text-gray-400 text-center leading-relaxed">
                By signing in, you agree that this is a third-party management tool and 
                acknowledge our <NuxtLink to="/about" class="text-primary-600 hover:underline">disclaimer</NuxtLink>.
                Your credentials are never stored or shared.
              </p>
            </div>
          </div>
        </div>

      </div>

      <!-- Footer -->
      <div class="text-center mt-6 text-sm text-gray-600 dark:text-gray-400">
        <p>Sosmed HUB &copy; 2026 - Professional Social Media Management</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Ensure gradient stays smooth */
.bg-gradient-to-br {
  background-image: linear-gradient(to bottom right, var(--tw-gradient-stops));
}
</style>
