<script setup lang="ts">
import type { DropdownMenuItem } from "@nuxt/ui";

defineProps<{
  collapsed?: boolean;
}>();

const colorMode = useColorMode();
const appConfig = useAppConfig();
const { user, isAuthenticated, logout, logoutAll, isAdmin, isAdminOrOps, canManageUsers } = useAuth();

const colors = [
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "rose",
];
const neutrals = ["slate", "gray", "zinc", "neutral", "stone"];

// Compute user display info
const displayUser = computed(() => {
  if (!isAuthenticated.value || !user.value) {
    return {
      name: "Guest",
      avatar: {
        src: "",
        alt: "Guest",
      },
      initials: "G",
    };
  }

  const name = user.value.fullName || user.value.username;
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return {
    name,
    avatar: {
      src: "", // No avatar URL for now
      alt: name,
    },
    initials,
  };
});

// Get role badge text
const roleBadge = computed(() => {
  if (!user.value?.roles.length) return null;
  const primaryRole = user.value.roles[0];
  return primaryRole?.name ?? null;
});

// Build menu items based on auth state and permissions
const items = computed<DropdownMenuItem[][]>(() => {
  const menuItems: DropdownMenuItem[][] = [];

  // User info header
  menuItems.push([
    {
      type: "label",
      label: displayUser.value.name,
      avatar: displayUser.value.avatar.src
        ? displayUser.value.avatar
        : undefined,
      icon: !displayUser.value.avatar.src ? "i-lucide-user-circle" : undefined,
    },
  ]);

  // User actions (only if authenticated)
  if (isAuthenticated.value) {
    const userActions: DropdownMenuItem[] = [
      {
        label: "Profile",
        icon: "i-lucide-user",
        to: "/settings",
      },
    ];

    menuItems.push(userActions);
  }

  // Theme options
  menuItems.push([
    {
      label: "Theme",
      icon: "i-lucide-palette",
      children: [
        {
          label: "Primary",
          slot: "chip",
          chip: appConfig.ui.colors.primary,
          content: {
            align: "center",
            collisionPadding: 16,
          },
          children: colors.map((color) => ({
            label: color,
            chip: color,
            slot: "chip",
            checked: appConfig.ui.colors.primary === color,
            type: "checkbox" as const,
            onSelect: (e: Event) => {
              e.preventDefault();
              appConfig.ui.colors.primary = color;
            },
          })),
        },
        {
          label: "Neutral",
          slot: "chip",
          chip:
            appConfig.ui.colors.neutral === "neutral"
              ? "old-neutral"
              : appConfig.ui.colors.neutral,
          content: {
            align: "end",
            collisionPadding: 16,
          },
          children: neutrals.map((color) => ({
            label: color,
            chip: color === "neutral" ? "old-neutral" : color,
            slot: "chip",
            type: "checkbox" as const,
            checked: appConfig.ui.colors.neutral === color,
            onSelect: (e: Event) => {
              e.preventDefault();
              appConfig.ui.colors.neutral = color;
            },
          })),
        },
      ],
    },
    {
      label: "Appearance",
      icon: "i-lucide-sun-moon",
      children: [
        {
          label: "Light",
          icon: "i-lucide-sun",
          type: "checkbox",
          checked: colorMode.value === "light",
          onSelect(e: Event) {
            e.preventDefault();
            colorMode.preference = "light";
          },
        },
        {
          label: "Dark",
          icon: "i-lucide-moon",
          type: "checkbox",
          checked: colorMode.value === "dark",
          onUpdateChecked(checked: boolean) {
            if (checked) {
              colorMode.preference = "dark";
            }
          },
          onSelect(e: Event) {
            e.preventDefault();
          },
        },
      ],
    },
  ]);

  // Auth actions
  if (isAuthenticated.value) {
    menuItems.push([
      {
        label: "Log out",
        icon: "i-lucide-log-out",
        onSelect: async () => {
          await logout();
        },
      },
    ]);
  } else {
    menuItems.push([
      {
        label: "Log in",
        icon: "i-lucide-log-in",
        to: "/login",
      },
    ]);
  }

  return menuItems;
});
</script>

<template>
  <UDropdownMenu
    :items="items"
    :content="{ align: 'center', collisionPadding: 12 }"
    :ui="{
      content: collapsed ? 'w-48' : 'w-(--reka-dropdown-menu-trigger-width)',
    }"
  >
    <UButton
      :label="collapsed ? undefined : displayUser.name"
      :trailing-icon="collapsed ? undefined : 'i-lucide-chevrons-up-down'"
      color="neutral"
      variant="ghost"
      block
      :square="collapsed"
      class="data-[state=open]:bg-elevated"
      :ui="{
        trailingIcon: 'text-dimmed',
      }"
    >
      <template #leading>
        <UAvatar
          v-if="displayUser.avatar.src"
          :src="displayUser.avatar.src"
          :alt="displayUser.avatar.alt"
          size="2xs"
        />
        <UAvatar v-else :text="displayUser.initials" size="2xs" />
      </template>
    </UButton>

    <template #chip-leading="{ item }">
      <div class="inline-flex items-center justify-center shrink-0 size-5">
        <span
          class="rounded-full ring ring-bg bg-(--chip-light) dark:bg-(--chip-dark) size-2"
          :style="{
            '--chip-light': `var(--color-${(item as any).chip}-500)`,
            '--chip-dark': `var(--color-${(item as any).chip}-400)`,
          }"
        />
      </div>
    </template>
  </UDropdownMenu>
</template>
