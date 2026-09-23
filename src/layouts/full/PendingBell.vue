<script setup lang="ts">
import { onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { usePendingStore } from '@/stores/pending';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const pending = usePendingStore();

watch(() => [route.path, authStore.clientstoreId], () => pending.refresh());
onMounted(() => pending.refresh());
</script>

<template>
  <v-menu v-if="authStore.clientstoreId && $can('pending_costs_view', 'Pending Cost')" location="bottom end">
    <template v-slot:activator="{ props }">
      <v-btn icon variant="text" color="primary" v-bind="props" title="Pending bought prices">
        <v-badge :model-value="pending.count > 0" :content="pending.count" color="error">
          <v-icon>mdi-bell-outline</v-icon>
        </v-badge>
      </v-btn>
    </template>
    <v-card class="menu-card" width="320" elevation="8" rounded="lg">
      <div class="pa-4 d-flex align-start ga-3">
        <v-avatar :color="pending.count ? 'lighterror' : 'lightsuccess'" size="40">
          <v-icon :color="pending.count ? 'error' : 'success'">{{ pending.count ? 'mdi-clock-alert-outline' : 'mdi-check-circle-outline' }}</v-icon>
        </v-avatar>
        <div>
          <div class="font-weight-bold">{{ pending.count ? `${pending.count} bought price${pending.count === 1 ? '' : 's'} missing` : 'No pending bought prices' }}</div>
          <div class="text-caption text-lightText">
            {{ pending.count ? 'Items sold from another shopkeeper. Enter what you paid so today\'s profit is right. A counter cannot close until its items are filled.' : 'Every item sold has its bought price.' }}
          </div>
        </div>
      </div>
      <div v-if="pending.count" class="px-4 pb-4">
        <v-btn color="primary" variant="flat" block prepend-icon="mdi-pencil-outline" @click="router.push('/pending-costs')">Enter Bought Prices</v-btn>
      </div>
    </v-card>
  </v-menu>
</template>
