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
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
    <div class="w-full max-w-6xl">
      <div class="grid md:grid-cols-2 gap-0 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-800">
        
        <!-- LEFT SIDE - Disclaimer & Info (Black & White Theme) -->
        <div class="bg-gray-900 dark:bg-black p-8 md:p-12 flex flex-col justify-center text-white border-r border-gray-800">
          <!-- Logo & Brand -->
          <div class="mb-8">
            <div class="inline-flex items-center justify-center w-16 h-16 bg-white/10 backdrop-blur-sm rounded-2xl mb-4 border border-white/20">
              <UIcon name="i-lucide-shield-check" class="w-8 h-8 text-white" />
            </div>
            <h1 class="text-3xl md:text-4xl font-bold mb-2 text-white">Sosmed HUB</h1>
            <p class="text-lg text-gray-300">Social Media Management Platform</p>
          </div>

          <!-- Security Notice -->
          <div class="space-y-4 mb-8">
            <div class="bg-white/5 backdrop-blur-sm rounded-xl p-5 border border-white/10 hover:border-white/20 transition-colors">
              <div class="flex items-start gap-3">
                <div class="p-2 bg-white/10 rounded-lg flex-shrink-0">
                  <UIcon name="i-lucide-lock-keyhole" class="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 class="font-semibold text-base mb-1 text-white">Your Data is Safe</h3>
                  <p class="text-sm text-gray-300 leading-relaxed">
                    We do <strong class="text-white">NOT</strong> store your social media passwords. 
                    All authentication is handled through official OAuth protocols.
                  </p>
                </div>
              </div>
            </div>

            <div class="bg-white/5 backdrop-blur-sm rounded-xl p-5 border border-white/10 hover:border-white/20 transition-colors">
              <div class="flex items-start gap-3">
                <div class="p-2 bg-white/10 rounded-lg flex-shrink-0">
                  <UIcon name="i-lucide-shield-alert" class="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 class="font-semibold text-base mb-1 text-white">Not a Phishing Site</h3>
                  <p class="text-sm text-gray-300 leading-relaxed">
                    This is a legitimate business management platform. We are <strong class="text-white">NOT</strong> affiliated 
                    with any major social media platform. This is an independent third-party tool.
                  </p>
                </div>
              </div>
            </div>

            <div class="bg-white/5 backdrop-blur-sm rounded-xl p-5 border border-white/10 hover:border-white/20 transition-colors">
              <div class="flex items-start gap-3">
                <div class="p-2 bg-white/10 rounded-lg flex-shrink-0">
                  <UIcon name="i-lucide-eye-off" class="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 class="font-semibold text-base mb-1 text-white">Privacy Protected</h3>
                  <p class="text-sm text-gray-300 leading-relaxed">
                    We only access analytics data through official APIs. 
                    Your sensitive information is <strong class="text-white">NEVER</strong> collected or shared.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Additional Info -->
          <div class="space-y-3 text-sm text-gray-300 border-t border-white/10 pt-6">
            <div class="flex items-center gap-2">
              <div class="w-1.5 h-1.5 bg-white rounded-full"></div>
              <span>End-to-end encryption</span>
            </div>
            <div class="flex items-center gap-2">
              <div class="w-1.5 h-1.5 bg-white rounded-full"></div>
              <span>JWT-based authentication</span>
            </div>
            <div class="flex items-center gap-2">
              <div class="w-1.5 h-1.5 bg-white rounded-full"></div>
              <span>Role-based access control</span>
            </div>
            <div class="flex items-center gap-2">
              <div class="w-1.5 h-1.5 bg-white rounded-full"></div>
              <span>Regular security audits</span>
            </div>
          </div>

          <!-- Footer Links -->
          <div class="mt-auto pt-8 border-t border-white/10 flex flex-wrap gap-4 text-sm">
            <NuxtLink to="/about" class="text-gray-400 hover:text-white transition-colors">
              About & Disclaimer
            </NuxtLink>
            <a href="https://github.com/muhrobby/sosmed-hub" target="_blank" rel="noopener noreferrer" class="text-gray-400 hover:text-white transition-colors flex items-center gap-1">
              <UIcon name="i-lucide-github" class="w-4 h-4" />
              GitHub
            </a>
          </div>
        </div>

        <!-- RIGHT SIDE - Login Form (White Theme) -->
        <div class="bg-white dark:bg-gray-900 p-8 md:p-12 flex flex-col justify-center">
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
                color="gray"
                :loading="isLoading"
                :disabled="isLoading || !form.username || !form.password"
                class="mt-6 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900"
              >
                <template #leading>
                  <UIcon v-if="!isLoading" name="i-lucide-log-in" />
                </template>
                {{ isLoading ? "Signing in..." : "Sign in" }}
              </UButton>
            </form>

            <!-- Additional Info -->
            <div class="mt-8 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <p class="text-xs text-gray-600 dark:text-gray-400 text-center leading-relaxed">
                By signing in, you agree that this is a third-party management tool and 
                acknowledge our <NuxtLink to="/about" class="text-gray-900 dark:text-white hover:underline font-medium">disclaimer</NuxtLink>.
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
/* Smooth transitions */
.transition-colors {
  transition: color 0.2s ease-in-out, background-color 0.2s ease-in-out, border-color 0.2s ease-in-out;
}
</style>
