<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const authStore = useAuthStore();
const menu = ref(false);
const items = ref<any[]>([]);
const search = ref('');

const filteredItems = computed(() => {
  const term = search.value.trim().toLowerCase();
  if (!term) return items.value;
  return items.value.filter((item) => `${item.store_name} ${item.store_code} ${item.store_type || ''}`.toLowerCase().includes(term));
});

async function selectStore(store: any) {
  menu.value = false;
  if (store.id === authStore.clientstoreId) return;
  try {
    await authStore.storeLogin(store.id, store.store_name, false);
  } catch (error) {
    console.error('Failed to switch shop', error);
  }
}

function allShops() {
  menu.value = false;
  authStore.clearStore();
  router.push('/shops');
}

async function fetchData() {
  try {
    items.value = (await axios.get('clientstores/list')).data;
  } catch (error) {
    console.error('Failed to fetch shops', error);
  }
}

watch(menu, (open) => {
  if (open) {
    search.value = '';
    fetchData();
  }
});
</script>

<template>
  <span v-if="authStore.isStoreBound" class="branch-chip">
    <v-icon size="16" color="primary">mdi-storefront-outline</v-icon>{{ authStore.storeName }}
  </span>

  <v-menu v-else v-model="menu" :close-on-content-click="false" location="bottom start">
    <template v-slot:activator="{ props }">
      <button class="branch-chip branch-chip--button" v-bind="props">
        <v-icon size="16" color="primary">mdi-storefront-outline</v-icon>
        <span>{{ authStore.storeName || 'Select Shop' }}</span>
        <v-icon size="16">{{ menu ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
      </button>
    </template>
    <v-card class="menu-card" width="340" elevation="8" rounded="lg">
      <div class="menu-card__header">
        <div class="d-flex align-center ga-2">
          <v-icon size="18" color="primary">mdi-storefront-outline</v-icon>
          <span class="font-weight-bold">Select Shop</span>
        </div>
        <span class="text-caption text-lightText">{{ items.length }} shop{{ items.length === 1 ? '' : 's' }}</span>
      </div>
      <div class="pa-3">
        <v-text-field v-model="search" prepend-inner-icon="mdi-magnify" placeholder="Find shop..." hide-details autofocus />
        <div class="branch-list mt-2">
          <button v-for="store in filteredItems" :key="store.id" type="button" class="branch-item"
            :class="{ 'branch-item--active': store.id === authStore.clientstoreId }" @click="selectStore(store)">
            <div class="text-start">
              <div class="font-weight-semibold">{{ store.store_name }}</div>
              <div class="text-caption text-lightText">{{ store.store_code }}<span v-if="store.store_type"> · {{ store.store_type }}</span></div>
            </div>
            <v-icon v-if="store.id === authStore.clientstoreId" size="18" color="primary">mdi-check-circle</v-icon>
          </button>
          <p v-if="!filteredItems.length" class="text-caption text-lightText text-center py-4 mb-0">No shops found</p>
        </div>
      </div>
      <div v-if="$can('shops_view', 'Shops')" class="menu-card__footer">
        <v-btn variant="outlined" color="primary" size="small" prepend-icon="mdi-view-grid-outline" @click="allShops">All Shops</v-btn>
      </div>
    </v-card>
  </v-menu>
</template>

<style scoped>
.branch-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 38px;
  padding: 0 12px;
  border: 1px solid rgb(var(--v-theme-borderColor));
  border-radius: 8px;
  background: rgb(var(--v-theme-lightprimary));
  font-size: 13px;
  font-weight: 600;
  color: rgb(var(--v-theme-textPrimary));
  white-space: nowrap;
}

.branch-chip--button {
  cursor: pointer;
}

.branch-chip--button:hover {
  border-color: rgb(var(--v-theme-primary));
}

.menu-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid rgb(var(--v-theme-borderColor));
}

.menu-card__footer {
  padding: 10px 14px;
  border-top: 1px solid rgb(var(--v-theme-borderColor));
}

.branch-list {
  max-height: 280px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.branch-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border: 1px solid rgb(var(--v-theme-borderColor));
  border-radius: 8px;
  background: #fff;
}

.branch-item:hover {
  background: rgb(var(--v-theme-hoverColor));
}

.branch-item--active {
  border-color: rgb(var(--v-theme-primary));
  background: rgb(var(--v-theme-lightprimary));
}
</style>
