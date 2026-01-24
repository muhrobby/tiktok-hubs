<script setup lang="ts">
defineProps<{
  collapsed?: boolean
}>()
</script>

<template>
  <NuxtLink
    to="/"
    class="flex items-center gap-3 px-3 py-2 hover:bg-elevated/50 transition-colors rounded-md"
    :class="collapsed ? 'justify-center' : ''"
  >
    <div class="flex items-center justify-center shrink-0 size-8 rounded-lg bg-primary/10 text-primary">
      <UIcon name="i-lucide-store" class="size-5" />
    </div>
    <div v-if="!collapsed" class="flex flex-col">
      <span class="text-sm font-semibold">TikTok Hubs</span>
      <span class="text-xs text-muted-foreground">Store Management</span>
    </div>
  </NuxtLink>
</template>
