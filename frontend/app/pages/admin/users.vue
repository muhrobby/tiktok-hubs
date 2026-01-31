<script setup lang="ts">
import type { TableColumn } from "@nuxt/ui";
import { h } from "vue";

// Auth protection - Admin only
definePageMeta({
  middleware: "auth",
  requiredPermissions: ["view_users"],
});

useHead({
  title: "User Management - Sosmed HUB",
});

const UBadge = resolveComponent("UBadge");
const UButton = resolveComponent("UButton");
const UDropdownMenu = resolveComponent("UDropdownMenu");

const toast = useToast();
const { canManageUsers, hasPermission } = useAuth();

// Types
interface Role {
  id: number;
  name: "Admin" | "Ops" | "Store";
  description: string;
  permissions: string[];
}

interface UserRole {
  name: "Admin" | "Ops" | "Store";
  storeCode: string | null;
}

interface User {
  id: number;
  username: string;
  email: string | null;
  fullName: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  roles: UserRole[];
}

// State
const users = ref<User[]>([]);
const roles = ref<Role[]>([]);
const stores = ref<{ storeCode: string; storeName: string }[]>([]);
const loading = ref(true);
const searchQuery = ref("");
const selectedRole = ref<string>("all");
const selectedStatus = ref<string>("all");

// Pagination
const pagination = ref({
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
});

// Modal states
const isCreateModalOpen = ref(false);
const isEditModalOpen = ref(false);
const isDeleteModalOpen = ref(false);
const isAssignRoleModalOpen = ref(false);
const selectedUser = ref<User | null>(null);

// Form data
const createFormData = ref({
  username: "",
  password: "",
  email: "",
  fullName: "",
  isActive: true,
});

const editFormData = ref({
  email: "",
  fullName: "",
  isActive: true,
  password: "",
});

const assignRoleFormData = ref({
  roleName: "Store" as "Admin" | "Ops" | "Store",
  storeCode: "",
});

// Form errors
const formErrors = ref<Record<string, string>>({});
const isSubmitting = ref(false);

// Load users
const loadUsers = async () => {
  try {
    loading.value = true;
    const params = new URLSearchParams();
    if (searchQuery.value) params.set("search", searchQuery.value);
    if (selectedRole.value !== "all") params.set("roleName", selectedRole.value);
    if (selectedStatus.value !== "all")
      params.set("isActive", selectedStatus.value);
    params.set("page", pagination.value.page.toString());
    params.set("limit", pagination.value.limit.toString());

    const response = await $fetch<{
      success: boolean;
      data: User[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }>(`/api/admin/users/?${params.toString()}`);

    if (response.success) {
      // Transform roleName to name for compatibility
      users.value = response.data.map(user => ({
        ...user,
        roles: user.roles.map((role: any) => ({
          name: role.roleName || role.name,
          storeCode: role.storeCode,
        })),
      }));
      pagination.value = {
        ...pagination.value,
        ...response.pagination,
      };
    }
  } catch (error) {
    console.error("Error loading users:", error);
        toast.add({
          title: "Error",
          description: "Failed to load users",
          color: "gray",
        });
  } finally {
    loading.value = false;
  }
};

// Load roles
const loadRoles = async () => {
  try {
    const response = await $fetch<{
      success: boolean;
      data: Role[];
    }>("/api/admin/users/roles");

    if (response.success) {
      roles.value = response.data;
    }
  } catch (error) {
    console.error("Error loading roles:", error);
  }
};

// Load stores for dropdown
const loadStores = async () => {
  try {
    const response = await $fetch<{
      success: boolean;
      data: { storeCode: string; storeName: string }[];
    }>("/api/admin/stores");

    if (response.success && response.data) {
      stores.value = response.data.map((store: any) => ({
        storeCode: store.store_code || store.storeCode,
        storeName: store.store_name || store.storeName
      }));
    }
  } catch (error) {
    console.error("Error loading stores:", error);
  }
};

// Create user
const handleCreateUser = async () => {
  formErrors.value = {};

  if (!createFormData.value.username) {
    formErrors.value.username = "Username is required";
    return;
  }
  if (!createFormData.value.password || createFormData.value.password.length < 8) {
    formErrors.value.password = "Password must be at least 8 characters";
    return;
  }

  try {
    isSubmitting.value = true;
    const response = await $fetch<{
      success: boolean;
      data?: User;
      error?: { message: string };
    }>("/api/admin/users", {
      method: "POST",
      body: createFormData.value,
    });

    if (response.success) {
      toast.add({
        title: "Success",
        description: "User created successfully",
        color: "gray",
      });
      isCreateModalOpen.value = false;
      resetCreateForm();
      await loadUsers();
    } else {
      toast.add({
        title: "Error",
        description: response.error?.message || "Failed to create user",
        color: "gray",
      });
    }
  } catch (error: unknown) {
    const err = error as { data?: { error?: { message?: string } } };
    toast.add({
      title: "Error",
      description: err?.data?.error?.message || "Failed to create user",
      color: "gray",
    });
  } finally {
    isSubmitting.value = false;
  }
};

// Update user
const handleUpdateUser = async () => {
  if (!selectedUser.value) return;

  try {
    isSubmitting.value = true;
    const body: Record<string, unknown> = {
      email: editFormData.value.email || null,
      fullName: editFormData.value.fullName || null,
      isActive: editFormData.value.isActive,
    };
    if (editFormData.value.password) {
      body.password = editFormData.value.password;
    }

    const response = await $fetch<{
      success: boolean;
      data?: User;
      error?: { message: string };
    }>(`/api/admin/users/${selectedUser.value.id}`, {
      method: "PUT",
      body,
    });

    if (response.success) {
      toast.add({
        title: "Success",
        description: "User updated successfully",
        color: "gray",
      });
      isEditModalOpen.value = false;
      await loadUsers();
    } else {
      toast.add({
        title: "Error",
        description: response.error?.message || "Failed to update user",
        color: "gray",
      });
    }
  } catch (error: unknown) {
    const err = error as { data?: { error?: { message?: string } } };
    toast.add({
      title: "Error",
      description: err?.data?.error?.message || "Failed to update user",
      color: "gray",
    });
  } finally {
    isSubmitting.value = false;
  }
};

// Delete user
const handleDeleteUser = async () => {
  if (!selectedUser.value) return;

  try {
    isSubmitting.value = true;
    const response = await $fetch<{
      success: boolean;
      error?: { message: string };
    }>(`/api/admin/users/${selectedUser.value.id}`, {
      method: "DELETE",
    });

    if (response.success) {
      toast.add({
        title: "Success",
        description: "User deleted successfully",
        color: "gray",
      });
      isDeleteModalOpen.value = false;
      selectedUser.value = null;
      await loadUsers();
    } else {
      toast.add({
        title: "Error",
        description: response.error?.message || "Failed to delete user",
        color: "gray",
      });
    }
  } catch (error: unknown) {
    const err = error as { data?: { error?: { message?: string } } };
    toast.add({
      title: "Error",
      description: err?.data?.error?.message || "Failed to delete user",
      color: "gray",
    });
  } finally {
    isSubmitting.value = false;
  }
};

// Assign role
const handleAssignRole = async () => {
  if (!selectedUser.value) return;

  try {
    isSubmitting.value = true;
    const response = await $fetch<{
      success: boolean;
      data?: { roles: UserRole[] };
      error?: { message: string };
    }>(`/api/admin/users/${selectedUser.value.id}/roles`, {
      method: "POST",
      body: {
        roleName: assignRoleFormData.value.roleName,
        storeCode: assignRoleFormData.value.storeCode || undefined,
      },
    });

    if (response.success) {
      toast.add({
        title: "Success",
        description: "Role assigned successfully",
        color: "gray",
      });
      isAssignRoleModalOpen.value = false;
      await loadUsers();
    } else {
      toast.add({
        title: "Error",
        description: response.error?.message || "Failed to assign role",
        color: "gray",
      });
    }
  } catch (error: unknown) {
    const err = error as { data?: { error?: { message?: string } } };
    toast.add({
      title: "Error",
      description: err?.data?.error?.message || "Failed to assign role",
      color: "gray",
    });
  } finally {
    isSubmitting.value = false;
  }
};

// Remove role
const handleRemoveRole = async (user: User, role: UserRole) => {
  try {
    const params = role.storeCode ? `?storeCode=${role.storeCode}` : "";
    const response = await $fetch<{
      success: boolean;
      error?: { message: string };
    }>(`/api/admin/users/${user.id}/roles/${role.name}${params}`, {
      method: "DELETE",
    });

    if (response.success) {
      toast.add({
        title: "Success",
        description: "Role removed successfully",
        color: "gray",
      });
      await loadUsers();
      
      // Close modal if user has no more roles
      if (selectedUser.value && selectedUser.value.id === user.id) {
        const updatedUser = users.value.find(u => u.id === user.id);
        if (updatedUser && updatedUser.roles.length === 0) {
          isAssignRoleModalOpen.value = false;
          selectedUser.value = null;
        }
      }
    } else {
      toast.add({
        title: "Error",
        description: response.error?.message || "Failed to remove role",
        color: "gray",
      });
    }
  } catch (error: unknown) {
    const err = error as { data?: { error?: { message?: string } } };
    toast.add({
      title: "Error",
      description: err?.data?.error?.message || "Failed to remove role",
      color: "gray",
    });
  }
};

// Reset forms
const resetCreateForm = () => {
  createFormData.value = {
    username: "",
    password: "",
    email: "",
    fullName: "",
    isActive: true,
  };
  formErrors.value = {};
};

// Open edit modal
const openEditModal = (user: User) => {
  selectedUser.value = user;
  editFormData.value = {
    email: user.email || "",
    fullName: user.fullName || "",
    isActive: user.isActive,
    password: "",
  };
  isEditModalOpen.value = true;
};

// Open delete modal
const openDeleteModal = (user: User) => {
  selectedUser.value = user;
  isDeleteModalOpen.value = true;
};

// Open assign role modal
const openAssignRoleModal = (user: User) => {
  selectedUser.value = user;
  assignRoleFormData.value = {
    roleName: "Store",
    storeCode: "",
  };
  isAssignRoleModalOpen.value = true;
};

// Table columns
const columns: TableColumn<User>[] = [
  {
    accessorKey: "username",
    header: "Username",
    cell: ({ row }) =>
      h("div", { class: "font-medium" }, row.original.username),
  },
  {
    accessorKey: "fullName",
    header: "Full Name",
    cell: ({ row }) => row.original.fullName || "-",
  },
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => row.original.email || "-",
  },
  {
    id: "roles",
    header: "Roles",
    cell: ({ row }) =>
      h(
        "div",
        { class: "flex flex-wrap gap-1" },
        row.original.roles.map((role) =>
          h(
            UBadge,
            {
              color:
                role.name === "Admin"
                  ? "gray"
                  : role.name === "Ops"
                    ? "neutral"
                    : "neutral",
              variant: "subtle",
            },
            { default: () => (role.storeCode ? `${role.name}: ${role.storeCode}` : role.name) }
          )
        )
      ),
  },
  {
    accessorKey: "isActive",
    header: "Status",
    cell: ({ row }) =>
      h(
        UBadge,
        {
          color: row.original.isActive ? "gray" : "neutral",
          variant: "subtle",
        },
        { default: () => (row.original.isActive ? "Active" : "Inactive") }
      ),
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => {
      if (!hasPermission("manage_users")) {
        return h("span", { class: "text-muted" }, "-");
      }

      return h(
        UDropdownMenu,
        {
          items: [
            [
              {
                label: "Edit",
                icon: "i-lucide-pencil",
                onSelect: () => openEditModal(row.original),
              },
              {
                label: "Assign Role",
                icon: "i-lucide-user-plus",
                onSelect: () => openAssignRoleModal(row.original),
              },
            ],
            [
              {
                label: "Delete",
                icon: "i-lucide-trash",
                color: "error" as const,
                onSelect: () => openDeleteModal(row.original),
              },
            ],
          ],
          content: { align: "end" as const },
        },
        () =>
          h(UButton, {
            icon: "i-lucide-more-vertical",
            color: "neutral",
            variant: "ghost",
            size: "sm",
          })
      );
    },
  },
];

// Watch for filter changes
watch([searchQuery, selectedRole, selectedStatus], () => {
  pagination.value.page = 1;
  loadUsers();
});

// Initial load
onMounted(async () => {
  await Promise.all([loadUsers(), loadRoles(), loadStores()]);
});
</script>

<template>
  <div>
    <!-- Header -->
    <UDashboardNavbar title="User Management" icon="i-lucide-users">
      <template #leading>
        <UDashboardSidebarCollapse />
      </template>

      <template #right>
        <UButton
          v-if="canManageUsers"
          icon="i-lucide-plus"
          size="sm"
          @click="isCreateModalOpen = true"
        >
          Add User
        </UButton>
      </template>
    </UDashboardNavbar>

    <!-- Body -->
    <div class="p-4 sm:p-6">
      <!-- Filters -->
      <UCard class="mb-6">
        <div class="flex flex-col md:flex-row gap-4">
        <UInput
          v-model="searchQuery"
          icon="i-lucide-search"
          placeholder="Search by username, email, or name..."
          class="flex-1"
        />
        <USelect
          v-model="selectedRole"
          :items="[
            { label: 'All Roles', value: 'all' },
            { label: 'Admin', value: 'Admin' },
            { label: 'Ops', value: 'Ops' },
            { label: 'Store', value: 'Store' },
          ]"
          class="w-40"
        />
        <USelect
          v-model="selectedStatus"
          :items="[
            { label: 'All Status', value: 'all' },
            { label: 'Active', value: 'true' },
            { label: 'Inactive', value: 'false' },
          ]"
          class="w-40"
        />
      </div>
    </UCard>

    <!-- Users Table -->
    <UCard>
      <UTable
        :data="users"
        :columns="columns"
        :loading="loading"
      >
        <template #loading-state>
          <div class="flex items-center justify-center py-12">
            <UIcon
              name="i-lucide-loader-2"
              class="w-8 h-8 animate-spin text-gray-900 dark:text-white"
            />
          </div>
        </template>

        <template #empty-state>
          <div class="flex flex-col items-center justify-center py-12">
            <UIcon
              name="i-lucide-users"
              class="w-12 h-12 text-muted-foreground mb-4"
            />
            <p class="text-muted-foreground">No users found</p>
          </div>
        </template>
      </UTable>

      <!-- Pagination -->
      <div
        v-if="pagination.totalPages > 1"
        class="flex items-center justify-between px-2 py-4 border-t"
      >
        <div class="text-sm text-muted-foreground">
          Showing {{ (pagination.page - 1) * pagination.limit + 1 }} -
          {{ Math.min(pagination.page * pagination.limit, pagination.total) }}
          of {{ pagination.total }} users
        </div>
        <UPagination
          :default-page="pagination.page"
          :items-per-page="pagination.limit"
          :total="pagination.total"
          @update:page="(p) => { pagination.page = p; loadUsers(); }"
        />
      </div>
    </UCard>

    <!-- Create User Modal -->
    <UModal v-model:open="isCreateModalOpen" title="Add New User">
      <template #body>
        <form @submit.prevent="handleCreateUser" class="space-y-4">
          <UFormField label="Username" required class="w-full">
            <UInput
              v-model="createFormData.username"
              placeholder="Enter username"
              :color="formErrors.username ? 'error' : undefined"
              class="w-full"
            />
            <p v-if="formErrors.username" class="text-xs text-gray-800 dark:text-gray-200 mt-1">
              {{ formErrors.username }}
            </p>
          </UFormField>

          <UFormField label="Password" required class="w-full">
            <UInput
              v-model="createFormData.password"
              type="password"
              placeholder="Enter password (min 8 characters)"
              :color="formErrors.password ? 'error' : undefined"
              class="w-full"
            />
            <p v-if="formErrors.password" class="text-xs text-gray-800 dark:text-gray-200 mt-1">
              {{ formErrors.password }}
            </p>
          </UFormField>

          <UFormField label="Full Name" class="w-full">
            <UInput
              v-model="createFormData.fullName"
              placeholder="Enter full name"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Email" class="w-full">
            <UInput
              v-model="createFormData.email"
              type="email"
              placeholder="Enter email"
              class="w-full"
            />
          </UFormField>

          <UFormField class="w-full">
            <UCheckbox v-model="createFormData.isActive" label="Active" />
          </UFormField>

          <div class="flex justify-end gap-3 pt-4 border-t">
            <UButton
              type="button"
              color="neutral"
              variant="ghost"
              @click="isCreateModalOpen = false"
              :disabled="isSubmitting"
            >
              Cancel
            </UButton>
            <UButton type="submit" :loading="isSubmitting">
              Create User
            </UButton>
          </div>
        </form>
      </template>
    </UModal>

    <!-- Edit User Modal -->
    <UModal v-model:open="isEditModalOpen" title="Edit User">
      <template #body>
        <form @submit.prevent="handleUpdateUser" class="space-y-4">
          <UFormField label="Username" class="w-full">
            <UInput :model-value="selectedUser?.username" disabled class="w-full" />
          </UFormField>

          <UFormField label="Full Name" class="w-full">
            <UInput
              v-model="editFormData.fullName"
              placeholder="Enter full name"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Email" class="w-full">
            <UInput
              v-model="editFormData.email"
              type="email"
              placeholder="Enter email"
              class="w-full"
            />
          </UFormField>

          <UFormField label="New Password" description="Leave empty to keep current password" class="w-full">
            <UInput
              v-model="editFormData.password"
              type="password"
              placeholder="Enter new password"
              class="w-full"
            />
          </UFormField>

          <UFormField class="w-full">
            <UCheckbox v-model="editFormData.isActive" label="Active" />
          </UFormField>

          <div class="flex justify-end gap-3 pt-4 border-t">
            <UButton
              type="button"
              color="neutral"
              variant="ghost"
              @click="isEditModalOpen = false"
              :disabled="isSubmitting"
            >
              Cancel
            </UButton>
            <UButton type="submit" :loading="isSubmitting">
              Save Changes
            </UButton>
          </div>
        </form>
      </template>
    </UModal>

    <!-- Delete Confirmation Modal -->
    <UModal v-model:open="isDeleteModalOpen" title="Delete User">
      <template #body>
        <p class="text-muted-foreground mb-4">
          Are you sure you want to delete user
          <strong>{{ selectedUser?.username }}</strong>? This action cannot be
          undone.
        </p>

        <div class="flex justify-end gap-3 pt-4 border-t">
          <UButton
            color="neutral"
            variant="ghost"
            @click="isDeleteModalOpen = false"
            :disabled="isSubmitting"
          >
            Cancel
          </UButton>
          <UButton
            color="error"
            @click="handleDeleteUser"
            :loading="isSubmitting"
          >
            Delete User
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Assign Role Modal -->
    <UModal v-model:open="isAssignRoleModalOpen" title="Assign Role">
      <template #body>
        <form @submit.prevent="handleAssignRole" class="space-y-4">
          <p class="text-muted-foreground mb-4">
            Assign a role to <strong>{{ selectedUser?.username }}</strong>
          </p>

          <!-- Current roles -->
          <div v-if="selectedUser?.roles.length" class="mb-4">
            <p class="text-sm font-medium mb-2">Current Roles:</p>
            <div class="flex flex-wrap gap-2">
              <UBadge
                v-for="role in selectedUser?.roles"
                :key="`${role.name}-${role.storeCode}`"
                :color="
                  role.name === 'Admin'
                    ? 'gray'
                    : role.name === 'Ops'
                      ? 'neutral'
                      : 'neutral'
                "
                variant="subtle"
                class="cursor-pointer"
                @click="handleRemoveRole(selectedUser!, role)"
              >
                {{ role.storeCode ? `${role.name}: ${role.storeCode}` : role.name }}
                <UIcon name="i-lucide-x" class="w-3 h-3 ml-1" />
              </UBadge>
            </div>
          </div>

          <UFormField label="Role" required class="w-full">
            <USelect
              v-model="assignRoleFormData.roleName"
              :items="[
                { label: 'Admin', value: 'Admin' },
                { label: 'Ops', value: 'Ops' },
                { label: 'Store', value: 'Store' },
              ]"
              class="w-full"
            />
          </UFormField>

          <UFormField
            v-if="assignRoleFormData.roleName === 'Store'"
            label="Store Code"
            required
            class="w-full"
          >
            <USelect
              v-model="assignRoleFormData.storeCode"
              :items="stores.map(s => ({ label: `${s.storeCode} - ${s.storeName}`, value: s.storeCode }))"
              placeholder="Select store"
              class="w-full"
            />
          </UFormField>

          <div class="flex justify-end gap-3 pt-4 border-t">
            <UButton
              type="button"
              color="neutral"
              variant="ghost"
              @click="isAssignRoleModalOpen = false"
              :disabled="isSubmitting"
            >
              Cancel
            </UButton>
            <UButton
              type="submit"
              :loading="isSubmitting"
              :disabled="
                assignRoleFormData.roleName === 'Store' &&
                !assignRoleFormData.storeCode
              "
            >
              Assign Role
            </UButton>
          </div>
      </form>
    </template>
  </UModal>
    </div>
  </div>
</template>
