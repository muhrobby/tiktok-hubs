<script setup lang="ts">
/**
 * PageHeader Component
 * Consistent header with burger menu, title, description, and optional actions
 */

defineProps<{
  title: string
  description?: string
}>()

// Inject sidebar state from layout - NO FALLBACK to ensure single source of truth
const sidebar = inject<{ open: Ref<boolean> }>('sidebar')

if (!sidebar) {
  console.error('PageHeader: sidebar context not found. Make sure you are using this component inside default layout.')
}

const open = sidebar?.open ?? ref(false)
</script>

<template>
  <div class="flex flex-col gap-4 mb-6 md:mb-8">
    <!-- Title Row with Burger Menu -->
    <div class="flex items-start gap-3 min-w-0">
      <!-- Mobile Menu Toggle -->
      <UButton
        icon="i-lucide-menu"
        color="neutral"
        variant="ghost"
        class="lg:hidden flex-shrink-0 mt-1"
        @click="open = !open"
      />
      
      <div class="min-w-0 flex-1">
        <h1 class="text-2xl sm:text-3xl md:text-4xl font-bold mb-1 md:mb-2 break-words">{{ title }}</h1>
        <p v-if="description" class="text-xs sm:text-sm md:text-base text-gray-600 dark:text-gray-400 break-words">
          {{ description }}
        </p>
      </div>
    </div>
    
    <!-- Actions Row - Stacked on mobile -->
    <div v-if="$slots.actions" class="flex flex-wrap items-center gap-2 w-full">
      <slot name="actions" />
    </div>
  </div>
</template>
