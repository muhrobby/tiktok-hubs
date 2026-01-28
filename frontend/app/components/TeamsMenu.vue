<script setup lang="ts">
defineProps<{
  collapsed?: boolean
}>()
</script>

<template>
  <div class="flex items-center justify-between gap-2">
    <NuxtLink
      to="/"
      class="flex items-center gap-3 px-3 py-2 hover:bg-elevated/50 transition-colors rounded-md flex-1"
      :class="collapsed ? 'justify-center' : ''"
    >
      <div class="flex items-center justify-center shrink-0 size-8 rounded-lg bg-primary/10 text-primary">
        <UIcon name="i-lucide-store" class="size-5" />
      </div>
      <div v-if="!collapsed" class="flex flex-col">
        <span class="text-sm font-semibold">Sosmed HUB</span>
        <span class="text-xs text-muted-foreground">Store Management</span>
      </div>
    </NuxtLink>
    
    <UDashboardSidebarCollapse v-if="!collapsed" variant="ghost" class="mr-2" />
  </div>
</template>
