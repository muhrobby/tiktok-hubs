<script setup lang="ts">
import * as z from 'zod'
import type { FormError, FormSubmitEvent } from '@nuxt/ui'

const { changePassword, logoutAll } = useAuth();
const toast = useToast();

const passwordSchema = z.object({
  current: z.string().min(1, 'Current password is required'),
  new: z.string().min(8, 'Must be at least 8 characters'),
  confirm: z.string().min(1, 'Please confirm your password')
})

type PasswordSchema = z.output<typeof passwordSchema>

const password = reactive<Partial<PasswordSchema>>({
  current: undefined,
  new: undefined,
  confirm: undefined
})

const isChangingPassword = ref(false)
const showDeleteConfirm = ref(false)

const validate = (state: Partial<PasswordSchema>): FormError[] => {
  const errors: FormError[] = []
  if (state.current && state.new && state.current === state.new) {
    errors.push({ name: 'new', message: 'New password must be different from current password' })
  }
  if (state.new && state.confirm && state.new !== state.confirm) {
    errors.push({ name: 'confirm', message: 'Passwords do not match' })
  }
  return errors
}

async function onPasswordSubmit(event: FormSubmitEvent<PasswordSchema>) {
  isChangingPassword.value = true
  try {
    const success = await changePassword(event.data.current, event.data.new)
    if (success) {
      // Reset form
      password.current = undefined
      password.new = undefined
      password.confirm = undefined
    }
  } finally {
    isChangingPassword.value = false
  }
}

async function handleLogoutAllDevices() {
  await logoutAll()
}
</script>

<template>
  <!-- Password Change -->
  <UPageCard
    title="Password"
    description="Confirm your current password before setting a new one."
    variant="subtle"
  >
    <UForm
      :schema="passwordSchema"
      :state="password"
      :validate="validate"
      @submit="onPasswordSubmit"
      class="flex flex-col gap-4 max-w-xs"
    >
      <UFormField name="current" label="Current Password">
        <UInput
          v-model="password.current"
          type="password"
          placeholder="Current password"
          autocomplete="current-password"
          class="w-full"
        />
      </UFormField>

      <UFormField name="new" label="New Password">
        <UInput
          v-model="password.new"
          type="password"
          placeholder="New password"
          autocomplete="new-password"
          class="w-full"
        />
      </UFormField>

      <UFormField name="confirm" label="Confirm Password">
        <UInput
          v-model="password.confirm"
          type="password"
          placeholder="Confirm new password"
          autocomplete="new-password"
          class="w-full"
        />
      </UFormField>

      <UButton 
        label="Update Password" 
        class="w-fit" 
        type="submit"
        color="gray"
        :loading="isChangingPassword"
        :disabled="isChangingPassword"
      />
    </UForm>
  </UPageCard>

  <!-- Active Sessions -->
  <UPageCard
    title="Active Sessions"
    description="Manage your active login sessions across all devices."
    variant="subtle"
  >
    <div class="flex items-center justify-between">
      <div>
        <p class="text-sm text-dimmed">
          If you notice any suspicious activity, you can log out from all devices.
        </p>
      </div>
    </div>
    <template #footer>
      <UButton
        label="Log out all devices"
        color="neutral"
        variant="soft"
        icon="i-lucide-log-out"
        @click="handleLogoutAllDevices"
      />
    </template>
  </UPageCard>

  <!-- Account Deletion (placeholder) -->
  <UPageCard
    title="Danger Zone"
    description="Irreversible actions for your account."
    class="bg-gradient-to-tl from-gray-800/10 from-5% to-default dark:from-white/10"
  >
    <p class="text-sm text-dimmed">
      Account deletion is managed by administrators. Contact your admin if you need to delete your account.
    </p>
  </UPageCard>
</template>
