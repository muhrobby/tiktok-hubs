<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

const { user, fetchUser } = useAuth();
const toast = useToast();

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  username: z.string().min(2, 'Username must be at least 2 characters')
})

type ProfileSchema = z.output<typeof profileSchema>

// Initialize with current user data
const profile = reactive<Partial<ProfileSchema>>({
  name: '',
  email: '',
  username: ''
})

// Watch user changes and update form
watch(() => user.value, (newUser) => {
  if (newUser) {
    profile.name = newUser.fullName || ''
    profile.email = newUser.email || ''
    profile.username = newUser.username || ''
  }
}, { immediate: true })

const isSaving = ref(false)

async function onSubmit(event: FormSubmitEvent<ProfileSchema>) {
  isSaving.value = true
  try {
    const response = await $fetch<{
      success: boolean;
      data?: {
        id: number;
        username: string;
        email: string | null;
        fullName: string | null;
      };
      error?: { code: string; message: string };
    }>('/api/user-auth/profile', {
      method: 'PUT',
      body: {
        fullName: event.data.name || null,
        email: event.data.email || null,
      }
    })
    
    if (response.success) {
      // Refresh user data
      await fetchUser()
      
      toast.add({
        title: 'Success',
        description: 'Profile updated successfully.',
        icon: 'i-lucide-check',
        color: 'success'
      })
    } else {
      toast.add({
        title: 'Error',
        description: response.error?.message || 'Failed to update profile.',
        icon: 'i-lucide-alert-circle',
        color: 'error'
      })
    }
  } catch (error: unknown) {
    const err = error as { data?: { error?: { message?: string } } }
    toast.add({
      title: 'Error',
      description: err?.data?.error?.message || 'Failed to update profile.',
      icon: 'i-lucide-alert-circle',
      color: 'error'
    })
  } finally {
    isSaving.value = false
  }
}

// Get initials for avatar
const initials = computed(() => {
  if (!user.value) return ''
  const name = user.value.fullName || user.value.username
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
})
</script>

<template>
  <UForm
    id="settings"
    :schema="profileSchema"
    :state="profile"
    @submit="onSubmit"
  >
    <UPageCard
      title="Profile"
      description="Your public profile information."
      variant="naked"
      orientation="horizontal"
      class="mb-4"
    >
      <UButton
        form="settings"
        label="Save changes"
        color="neutral"
        type="submit"
        :loading="isSaving"
        :disabled="isSaving"
        class="w-fit lg:ms-auto"
      />
    </UPageCard>

    <UPageCard variant="subtle">
      <UFormField
        name="name"
        label="Full Name"
        description="Your display name shown throughout the application."
        required
        class="flex max-sm:flex-col justify-between items-start gap-4"
      >
        <UInput
          v-model="profile.name"
          placeholder="Enter your full name"
          autocomplete="name"
          class="w-full sm:w-80"
        />
      </UFormField>
      <USeparator />
      <UFormField
        name="email"
        label="Email"
        description="Your email address for notifications and communication."
        class="flex max-sm:flex-col justify-between items-start gap-4"
      >
        <UInput
          v-model="profile.email"
          type="email"
          placeholder="Enter your email"
          autocomplete="email"
          class="w-full sm:w-80"
        />
      </UFormField>
      <USeparator />
      <UFormField
        name="username"
        label="Username"
        description="Your unique username for logging in."
        required
        class="flex max-sm:flex-col justify-between items-start gap-4"
      >
        <UInput
          v-model="profile.username"
          placeholder="Enter your username"
          autocomplete="username"
          disabled
          class="w-full sm:w-80"
        />
        <template #hint>
          <span class="text-dimmed text-xs">Username cannot be changed</span>
        </template>
      </UFormField>
      <USeparator />
      <UFormField
        name="avatar"
        label="Avatar"
        description="Your profile picture."
        class="flex max-sm:flex-col justify-between sm:items-center gap-4"
      >
        <div class="flex flex-wrap items-center gap-3">
          <UAvatar
            :text="initials"
            size="lg"
          />
          <span class="text-sm text-dimmed">
            Avatar is generated from your initials
          </span>
        </div>
      </UFormField>
    </UPageCard>
  </UForm>
</template>
