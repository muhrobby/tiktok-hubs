<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent, FormError } from '@nuxt/ui'

// Auth protection
definePageMeta({
  middleware: "auth",
});

const { user, changePassword } = useAuth();
const toast = useToast();

// Password change form
const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your password')
})

type PasswordSchema = z.output<typeof passwordSchema>

const passwordForm = reactive<Partial<PasswordSchema>>({
  currentPassword: undefined,
  newPassword: undefined,
  confirmPassword: undefined
})

const isChangingPassword = ref(false)

const validatePassword = (state: Partial<PasswordSchema>): FormError[] => {
  const errors: FormError[] = []
  if (state.newPassword && state.confirmPassword && state.newPassword !== state.confirmPassword) {
    errors.push({ name: 'confirmPassword', message: 'Passwords do not match' })
  }
  if (state.currentPassword && state.newPassword && state.currentPassword === state.newPassword) {
    errors.push({ name: 'newPassword', message: 'New password must be different from current password' })
  }
  return errors
}

async function onPasswordSubmit(event: FormSubmitEvent<PasswordSchema>) {
  isChangingPassword.value = true
  try {
    const success = await changePassword(event.data.currentPassword, event.data.newPassword)
    if (success) {
      // Reset form
      passwordForm.currentPassword = undefined
      passwordForm.newPassword = undefined
      passwordForm.confirmPassword = undefined
    }
  } finally {
    isChangingPassword.value = false
  }
}

// Role badge color
const getRoleColor = (role: string) => {
  switch (role) {
    case 'Admin':
      return 'gray'
    case 'Ops':
      return 'neutral'
    case 'Store':
      return 'neutral'
    default:
      return 'neutral'
  }
}

// Format date
const formatDate = (dateString: string | null) => {
  if (!dateString) return 'Never'
  return new Date(dateString).toLocaleString()
}
</script>

<template>
  <div id="profile">
    <!-- Header -->
    <UDashboardNavbar title="Profile">
      <template #leading>
        <UDashboardSidebarCollapse />
      </template>
    </UDashboardNavbar>

    <!-- Body -->
    <div class="p-4 sm:p-6 lg:py-12">
      <div class="flex flex-col gap-6 lg:gap-12 w-full lg:max-w-2xl mx-auto">
        <!-- User Info Card -->
        <UPageCard
          title="Account Information"
          description="Your account details and role assignments."
          variant="subtle"
        >
          <div class="space-y-4">
            <!-- Avatar and Name -->
            <div class="flex items-center gap-4">
              <UAvatar
                :text="user?.fullName?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || user?.username?.slice(0, 2).toUpperCase()"
                size="xl"
              />
              <div>
                <h3 class="text-lg font-semibold">{{ user?.fullName || user?.username }}</h3>
                <p class="text-sm text-dimmed">@{{ user?.username }}</p>
              </div>
            </div>

            <USeparator />

            <!-- Details Grid -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p class="text-sm text-dimmed">Email</p>
                <p class="font-medium">{{ user?.email || 'Not set' }}</p>
              </div>
              <div>
                <p class="text-sm text-dimmed">Status</p>
                <UBadge :color="user?.isActive ? 'gray' : 'gray'" variant="subtle">
                  {{ user?.isActive ? 'Active' : 'Inactive' }}
                </UBadge>
              </div>
              <div>
                <p class="text-sm text-dimmed">Last Login</p>
                <p class="font-medium">{{ formatDate(user?.lastLoginAt ?? null) }}</p>
              </div>
              <div>
                <p class="text-sm text-dimmed">User ID</p>
                <p class="font-medium">#{{ user?.id }}</p>
              </div>
            </div>

            <USeparator />

            <!-- Roles -->
            <div>
              <p class="text-sm text-dimmed mb-2">Roles</p>
              <div class="flex flex-wrap gap-2">
                <UBadge
                  v-for="role in user?.roles"
                  :key="`${role.name}-${role.storeCode}`"
                  :color="getRoleColor(role.name)"
                  variant="subtle"
                  size="lg"
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

            <!-- Assigned Stores (for Store role) -->
            <div v-if="user?.assignedStores?.length">
              <p class="text-sm text-dimmed mb-2">Assigned Stores</p>
              <div class="flex flex-wrap gap-2">
                <UBadge
                  v-for="store in user.assignedStores"
                  :key="store"
                  color="gray"
                  variant="outline"
                >
                  {{ store }}
                </UBadge>
              </div>
            </div>
          </div>
        </UPageCard>

        <!-- Change Password Card -->
        <UPageCard
          title="Change Password"
          description="Update your password to keep your account secure."
          variant="subtle"
        >
          <UForm
            :schema="passwordSchema"
            :state="passwordForm"
            :validate="validatePassword"
            @submit="onPasswordSubmit"
            class="space-y-4"
          >
            <UFormField name="currentPassword" label="Current Password" required>
              <UInput
                v-model="passwordForm.currentPassword"
                type="password"
                placeholder="Enter current password"
                autocomplete="current-password"
                class="w-full max-w-xs"
              />
            </UFormField>

            <UFormField name="newPassword" label="New Password" required>
              <UInput
                v-model="passwordForm.newPassword"
                type="password"
                placeholder="Enter new password"
                autocomplete="new-password"
                class="w-full max-w-xs"
              />
            </UFormField>

            <UFormField name="confirmPassword" label="Confirm New Password" required>
              <UInput
                v-model="passwordForm.confirmPassword"
                type="password"
                placeholder="Confirm new password"
                autocomplete="new-password"
                class="w-full max-w-xs"
              />
            </UFormField>

            <UButton
              type="submit"
              label="Update Password"
              :loading="isChangingPassword"
              :disabled="isChangingPassword"
            />
          </UForm>
        </UPageCard>

        <!-- Security Info Card -->
        <UPageCard
          title="Security"
          description="Additional security information for your account."
          variant="subtle"
        >
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium">Active Sessions</p>
                <p class="text-sm text-dimmed">You're currently logged in on this device.</p>
              </div>
              <UButton
                color="error"
                variant="soft"
                label="Log out all devices"
                icon="i-lucide-log-out"
                @click="useAuth().logoutAll()"
              />
            </div>
          </div>
        </UPageCard>
      </div>
    </div>
  </div>
</template>
