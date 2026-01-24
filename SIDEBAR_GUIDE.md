# Sidebar Consistency Guide

## ✅ Best Practices untuk Sidebar

### 1. **JANGAN gunakan `inject('sidebar')` di pages**
❌ **WRONG**:
```typescript
// ❌ Di page component
const { open } = inject<{ open: Ref<boolean> }>('sidebar', { open: ref(false) });
```

✅ **CORRECT**:
```typescript
// ✅ Sidebar state di-manage oleh layout, tidak perlu inject
// Pages tidak perlu akses langsung ke sidebar state
```

**Alasan**: 
- Sidebar state sudah di-provide oleh `default.vue` layout
- Jika page inject dengan default value, bisa create duplicate state
- Menyebabkan inconsistency karena multiple sources of truth

---

### 2. **Menu items HARUS close sidebar setelah navigate**
✅ **CORRECT**:
```typescript
const links = computed<NavigationMenuItem[][]>(() => {
  const mainLinks: NavigationMenuItem[] = [
    {
      label: "Dashboard",
      icon: "i-lucide-layout-dashboard",
      to: "/",
      onSelect: () => {
        open.value = false; // ✅ Close sidebar on mobile
      },
    },
  ];
  return [mainLinks, secondaryLinks];
});
```

---

### 3. **Jangan manipulate sidebar dari child components**
❌ **WRONG**:
```typescript
// ❌ Di page component
const toggleSidebar = () => {
  const { open } = inject('sidebar');
  open.value = !open.value;
};
```

✅ **CORRECT**:
```typescript
// ✅ Biarkan Nuxt UI handle sidebar behavior
// UDashboardSidebar sudah punya built-in toggle
```

---

### 4. **Gunakan `collapsible` dan `resizable` props**
```vue
<UDashboardSidebar
  id="default"
  v-model:open="open"
  collapsible    <!-- ✅ Enable collapse on mobile -->
  resizable      <!-- ✅ Enable resize on desktop -->
  class="bg-elevated/25"
/>
```

---

### 5. **Secondary menu HARUS di bottom dengan spacer**
```vue
<template #default="{ collapsed }">
  <div class="flex flex-col flex-1 gap-4">
    <!-- Main navigation -->
    <UNavigationMenu :items="links[0]" />
    
    <!-- ✅ Spacer pushes secondary menu to bottom -->
    <div class="flex-1" />
    
    <!-- Secondary navigation (pinned to bottom) -->
    <UNavigationMenu v-if="links[1].length > 0" :items="links[1]" />
  </div>
</template>
```

---

### 6. **Overflow handling**
```typescript
:ui="{ 
  body: 'flex flex-col flex-1 overflow-y-auto', // ✅ Handle overflow
  content: 'min-h-0' // ✅ Prevent content from pushing sidebar
}"
```

---

## 🐛 Common Issues & Fixes

### Issue 1: Sidebar jumps when navigating
**Cause**: Page component creating new sidebar state
**Fix**: Remove all `inject('sidebar')` from pages

### Issue 2: Secondary menu not staying at bottom
**Cause**: Missing spacer div
**Fix**: Add `<div class="flex-1" />` between main and secondary menu

### Issue 3: Sidebar doesn't close on mobile after click
**Cause**: Missing `onSelect` handler
**Fix**: Add `onSelect: () => { open.value = false }` to all menu items

### Issue 4: Sidebar content overflowing
**Cause**: Missing overflow handling
**Fix**: Add `overflow-y-auto` to sidebar body UI config

---

## ✅ Checklist for New Pages

Saat membuat page baru:

- [ ] **JANGAN** add `inject('sidebar')` 
- [ ] Gunakan `PageHeader` component untuk consistency
- [ ] Test navigation dari/ke page baru
- [ ] Test di mobile (sidebar harus close setelah navigate)
- [ ] Verify secondary menu masih di bottom

---

## 🧪 Testing Sidebar Consistency

Run tests berikut setelah perubahan:

### Desktop:
1. [ ] Navigate ke semua pages - sidebar tetap visible
2. [ ] Click collapse button - sidebar minimize smoothly
3. [ ] Resize sidebar - position tetap stabil
4. [ ] Refresh page - sidebar state tetap sama

### Mobile:
1. [ ] Open burger menu - sidebar slide dari kiri
2. [ ] Click menu item - navigate DAN sidebar close
3. [ ] Click outside sidebar - sidebar close
4. [ ] Navigate back - sidebar tetap close

### All Pages:
1. [ ] Dashboard → TikTok Store Accounts
2. [ ] TikTok Store Accounts → Analytics
3. [ ] Analytics → Admin Users
4. [ ] Admin Users → Data Management
5. [ ] Data Management → Audit Logs
6. [ ] Audit Logs → Dashboard

Semua transition harus **smooth dan consistent**.

---

## 📁 Files yang Manage Sidebar

### Layout
- `frontend/app/layouts/default.vue` - **SINGLE SOURCE OF TRUTH**
  - Provide sidebar state: `provide('sidebar', { open })`
  - Manage menu items based on permissions
  - Handle collapse/expand behavior

### Components
- `frontend/app/components/TeamsMenu.vue` - Header logo
- `frontend/app/components/UserMenu.vue` - Footer user menu
- `frontend/app/components/NotificationsSlideover.vue` - Separate from sidebar

### Pages
- **TIDAK BOLEH** manipulate sidebar state
- **HANYA** navigate via menu items

---

## 🔧 If Sidebar Breaks Again

1. **Check for `inject('sidebar')`**:
   ```bash
   grep -r "inject.*sidebar" frontend/app/pages --include="*.vue"
   ```
   → Harus return EMPTY atau NONE

2. **Check menu items have `onSelect`**:
   ```bash
   grep -A5 "label.*Dashboard" frontend/app/layouts/default.vue
   ```
   → Harus ada `onSelect: () => { open.value = false }`

3. **Check spacer exists**:
   ```bash
   grep "flex-1" frontend/app/layouts/default.vue
   ```
   → Harus ada `<div class="flex-1" />`

4. **Restart dev server**:
   ```bash
   cd frontend && npm run dev
   ```

---

## 📝 Summary

**Golden Rules**:
1. ✅ Sidebar state di-manage HANYA oleh `default.vue`
2. ✅ Pages TIDAK boleh inject atau manipulate sidebar
3. ✅ Semua menu items harus close sidebar on select
4. ✅ Gunakan spacer untuk pin secondary menu ke bottom
5. ✅ Test di desktop DAN mobile setelah perubahan

Follow rules ini, sidebar akan **SELALU konsisten**! 🎉
