<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import { useAuthStore } from '@/stores/auth';
import { useAlerts } from '@/composables/useAlerts';
import { formatDate, formatMoney } from '@/utils/api';

const router = useRouter();
const authStore = useAuthStore();
const alerts = useAlerts();
const shops = ref<any[]>([]);
const loading = ref(true);
const opening = ref<number | null>(null);

const greeting = computed(() => {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
});

const totals = computed(() => ({
  sales: shops.value.reduce((sum, shop) => sum + shop.today.netSales, 0),
  profit: shops.value.reduce((sum, shop) => sum + shop.today.profit, 0),
  bills: shops.value.reduce((sum, shop) => sum + shop.today.bills, 0),
  provisional: shops.value.some((shop) => shop.today.provisional),
}));

const icons: Record<string, string> = {
  EPS: 'mdi-lightning-bolt',
  SIS: 'mdi-shield-check-outline',
};

async function load() {
  loading.value = true;
  try {
    shops.value = (await axios.get('clientstores/cards')).data;
  } catch (error) {
    alerts.fail(error);
  } finally {
    loading.value = false;
  }
}

async function open(shop: any, path = '/') {
  opening.value = shop.id;
  try {
    await authStore.storeLogin(shop.id, shop.store_name, true);
    router.push(path);
  } catch (error) {
    alerts.fail(error);
  } finally {
    opening.value = null;
  }
}

onMounted(load);
</script>

<template>
  <v-row>
    <v-col cols="12">
      <div class="shops-hero">
        <div>
          <div class="shops-hero__eyebrow">{{ formatDate(new Date()) }}</div>
          <h3 class="shops-hero__title">{{ greeting }}, {{ authStore.client?.full_name?.split(' ')[0] }}</h3>
          <p class="shops-hero__text">Open a shop to sell, see its counters and manage its items.</p>
        </div>
        <div class="shops-hero__stats">
          <div class="shops-hero__stat">
            <span>Both shops today</span>
            <strong>{{ formatMoney(totals.sales) }}</strong>
          </div>
          <div class="shops-hero__stat">
            <span>Profit <v-chip v-if="totals.provisional" size="x-small" color="warning" variant="flat" class="ml-1">Provisional</v-chip></span>
            <strong>{{ formatMoney(totals.profit) }}</strong>
          </div>
          <div class="shops-hero__stat">
            <span>Bills</span>
            <strong>{{ totals.bills }}</strong>
          </div>
        </div>
      </div>
      <v-alert v-model="alerts.showErrorAlert.value" :text="alerts.errorText.value" type="error" density="compact" class="mt-4 single-line-alert" closable />
    </v-col>

    <template v-if="loading">
      <v-col v-for="index in 2" :key="index" cols="12" md="6">
        <v-skeleton-loader type="card, list-item-two-line@2" class="border rounded-lg" />
      </v-col>
    </template>

    <v-col v-for="shop in shops" v-else :key="shop.id" cols="12" md="6">
      <div class="shop-card" :class="`shop-card--${shop.store_code.toLowerCase()}`" @click="open(shop)">
        <div class="shop-card__head">
          <div class="shop-card__icon">
            <v-icon size="30" color="white">{{ icons[shop.store_code] || 'mdi-storefront-outline' }}</v-icon>
          </div>
          <div class="flex-grow-1 overflow-hidden">
            <div class="shop-card__name">{{ shop.store_name }}</div>
            <div class="shop-card__type">{{ shop.store_type }} · {{ shop.store_code }}</div>
          </div>
          <v-icon color="white" size="26">mdi-arrow-right-circle</v-icon>
        </div>

        <div class="shop-card__stats">
          <div class="shop-card__stat">
            <span class="shop-card__label">Today's sales</span>
            <span class="shop-card__value">{{ formatMoney(shop.today.netSales) }}</span>
          </div>
          <div class="shop-card__stat">
            <span class="shop-card__label">
              Profit
              <v-chip v-if="shop.today.provisional" size="x-small" color="warning" variant="tonal" class="ml-1">Provisional</v-chip>
            </span>
            <span class="shop-card__value">{{ formatMoney(shop.today.profit) }}</span>
          </div>
          <div class="shop-card__stat">
            <span class="shop-card__label">Bills today</span>
            <span class="shop-card__value">{{ shop.today.bills }}</span>
          </div>
          <div class="shop-card__stat">
            <span class="shop-card__label">Counters open</span>
            <span class="shop-card__value">{{ shop.counters_open }} / {{ shop.counters_total }}</span>
          </div>
        </div>

        <div class="shop-card__foot">
          <v-chip v-if="shop.pending_costs" color="error" variant="tonal" size="small" prepend-icon="mdi-clock-alert-outline"
            @click.stop="open(shop, '/pending-costs')">{{ shop.pending_costs }} bought price{{ shop.pending_costs === 1 ? '' : 's' }} missing</v-chip>
          <v-chip v-else color="success" variant="tonal" size="small" prepend-icon="mdi-check-circle-outline">All bought prices entered</v-chip>
          <v-chip v-if="shop.open_quotations" color="primary" variant="tonal" size="small" prepend-icon="mdi-file-document-edit-outline"
            @click.stop="open(shop, '/quotations')">{{ shop.open_quotations }} open quotation{{ shop.open_quotations === 1 ? '' : 's' }}</v-chip>
          <v-spacer />
          <span class="text-caption text-lightText">{{ shop.products }} products</span>
          <v-btn color="primary" variant="flat" rounded="lg" :loading="opening === shop.id" @click.stop="open(shop)">Open Shop</v-btn>
        </div>
      </div>
    </v-col>
  </v-row>
</template>

<style scoped>
.shops-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 20px;
  padding: 22px 24px;
  border-radius: 14px;
  background: linear-gradient(135deg, #1e6fd0 0%, #1565c0 45%, #0f3460 100%);
  color: #fff;
}

.shops-hero__eyebrow {
  font-size: 12px;
  opacity: 0.8;
}

.shops-hero__title {
  font-size: 24px;
  font-weight: 700;
  margin: 2px 0 4px;
}

.shops-hero__text {
  font-size: 14px;
  opacity: 0.85;
  margin: 0;
}

.shops-hero__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.shops-hero__stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 150px;
  padding: 12px 16px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.14);
}

.shops-hero__stat span {
  font-size: 12px;
  opacity: 0.85;
}

.shops-hero__stat strong {
  font-size: 19px;
}

.shop-card {
  height: 100%;
  border: 1px solid rgb(var(--v-theme-borderColor));
  border-radius: 14px;
  background: #fff;
  overflow: hidden;
  cursor: pointer;
  transition: box-shadow 0.2s, transform 0.2s;
}

.shop-card:hover {
  box-shadow: 0 14px 30px rgba(15, 52, 96, 0.12);
  transform: translateY(-2px);
}

.shop-card__head {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 20px 22px;
  color: #fff;
  background: linear-gradient(135deg, #1565c0, #0f3460);
}

.shop-card--sis .shop-card__head {
  background: linear-gradient(135deg, #ea580c, #9a3412);
}

.shop-card__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 54px;
  height: 54px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.18);
}

.shop-card__name {
  font-size: 20px;
  font-weight: 700;
}

.shop-card__type {
  font-size: 13px;
  opacity: 0.85;
}

.shop-card__stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1px;
  background: rgb(var(--v-theme-borderColor));
  border-bottom: 1px solid rgb(var(--v-theme-borderColor));
}

.shop-card__stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 14px 22px;
  background: #fff;
}

.shop-card__label {
  display: flex;
  align-items: center;
  font-size: 12.5px;
  color: rgb(var(--v-theme-lightgray));
}

.shop-card__value {
  font-size: 20px;
  font-weight: 700;
  color: rgb(var(--v-theme-textPrimary));
}

.shop-card__foot {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 14px 22px;
}
</style>
