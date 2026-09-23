<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import UiParentCard from '@/components/shared/UiParentCard.vue';
import DashboardStatCard from '@/components/shared/DashboardStatCard.vue';
import { useAuthStore } from '@/stores/auth';
import { useAlerts } from '@/composables/useAlerts';
import { can } from '@/utils/permissions';
import { formatDate, formatDateTime, formatMoney, formatNumber } from '@/utils/api';

const router = useRouter();
const authStore = useAuthStore();
const alerts = useAlerts();
const loading = ref(true);
const data = ref<any>(null);

const cards = computed(() => {
  if (!data.value) return [];
  const today = data.value.today;
  return [
    { title: "Today's Sales", value: formatMoney(today.netSales), icon: 'mdi-cash-multiple', comparisonLabel: today.refunds ? `${today.bills} bills · ${formatMoney(today.refunds)} refunded` : `${today.bills} bills · yesterday ${formatMoney(data.value.yesterday.netSales)}` },
    { title: today.provisional ? "Today's Profit (provisional)" : "Today's Profit", value: formatMoney(today.profit), icon: 'mdi-chart-line', comparisonLabel: today.provisional ? `${today.pendingItems} bought price${today.pendingItems === 1 ? '' : 's'} still missing` : 'All bought prices entered', showInfoIcon: today.provisional },
    { title: 'Pending Bought Prices', value: data.value.pending_costs, icon: 'mdi-clock-alert-outline', comparisonLabel: 'Items from other shopkeepers', showInfoIcon: data.value.pending_costs > 0 },
    { title: 'Open Quotations', value: data.value.open_quotations, icon: 'mdi-file-document-edit-outline', comparisonLabel: 'Waiting for the customer' },
  ];
});

const quickActions = computed(() => [
  { title: 'Sell', icon: 'mdi-cash-register', to: '/pos', show: can('pos_sell', 'POS') },
  { title: 'Quotations', icon: 'mdi-file-document-edit-outline', to: '/quotations', show: can('quotations_view', 'Quotation') },
  { title: 'Pending Costs', icon: 'mdi-clock-alert-outline', to: '/pending-costs', show: can('pending_costs_view', 'Pending Cost') },
  { title: 'Counters', icon: 'mdi-counter', to: '/counters', show: can('counters_view', 'Counter') },
  { title: 'New Product', icon: 'mdi-package-variant-plus', to: '/products/create', show: can('products_create', 'Product') },
].filter((action) => action.show));

const paymentTotal = computed(() => (data.value?.today.payments || []).reduce((sum: number, row: any) => sum + row.amount, 0));

async function load() {
  if (!authStore.clientstoreId) return;
  loading.value = true;
  try {
    data.value = (await axios.get('dashboard/summary', { params: { clientstore_id: authStore.clientstoreId } })).data;
  } catch (error) {
    alerts.fail(error);
  } finally {
    loading.value = false;
  }
}

watch(() => authStore.clientstoreId, load);
onMounted(load);
</script>

<template>
  <v-alert v-model="alerts.showErrorAlert.value" :text="alerts.errorText.value" type="error" density="compact" class="mb-4 single-line-alert" closable />
  <v-row>
    <v-col v-for="index in (loading && !data ? 4 : 0)" :key="`s-${index}`" cols="12" sm="6" lg="3">
      <v-skeleton-loader type="list-item-two-line" class="border rounded-lg" />
    </v-col>
    <v-col v-for="card in cards" :key="card.title" cols="12" sm="6" lg="3">
      <DashboardStatCard v-bind="card" />
    </v-col>
  </v-row>

  <div class="mt-5">
    <UiParentCard :title="`${authStore.storeName || ''}`" icon="mdi-storefront-outline">
      <template #action>
        <span class="text-caption text-lightText">{{ formatDate(new Date()) }}</span>
        <v-btn variant="outlined" rounded="lg" size="small" :loading="loading" prepend-icon="mdi-refresh" @click="load">Refresh</v-btn>
      </template>
      <div class="d-flex flex-wrap ga-2">
        <v-btn v-for="action in quickActions" :key="action.to" variant="outlined" color="primary" rounded="lg"
          :prepend-icon="action.icon" class="quick-action" @click="router.push(action.to)">{{ action.title }}</v-btn>
      </div>
    </UiParentCard>
  </div>

  <v-row v-if="data" class="mt-1">
    <v-col cols="12">
      <UiParentCard title="Counters Right Now" icon="mdi-counter">
        <template #action>
          <v-btn v-if="can('counters_view', 'Counter')" variant="text" color="primary" size="small" @click="router.push('/counters')">All counters</v-btn>
        </template>
        <v-row>
          <v-col v-for="counter in data.counters" :key="counter.id" cols="12" sm="6" lg="4">
            <div class="counter-card" :class="{ 'counter-card--open': counter.status === 'Open' }">
              <div class="d-flex align-center justify-space-between">
                <span class="font-weight-bold"><v-icon size="18" class="me-1">mdi-counter</v-icon>{{ counter.name }}</span>
                <v-chip size="small" :color="counter.status === 'Open' ? 'success' : undefined" variant="tonal">{{ counter.status }}</v-chip>
              </div>
              <template v-if="counter.session">
                <div class="text-caption text-lightText mt-1">{{ counter.session.cashier?.full_name }} · since {{ formatDateTime(counter.session.opened_at) }}</div>
                <div class="d-flex justify-space-between mt-3">
                  <span class="text-lightText">Cash in counter</span><strong>{{ formatMoney(counter.session.totals.cash_now) }}</strong>
                </div>
                <div class="d-flex justify-space-between">
                  <span class="text-lightText">Bills</span><span>{{ counter.session.totals.bills }} · {{ formatMoney(counter.session.totals.sales_total) }}</span>
                </div>
                <div v-if="counter.session.totals.pending_costs" class="text-error text-caption font-weight-bold mt-1">
                  {{ counter.session.totals.pending_costs }} bought price{{ counter.session.totals.pending_costs === 1 ? '' : 's' }} pending
                </div>
              </template>
              <div v-else class="text-caption text-lightText mt-1">
                {{ counter.last_session ? `Closed ${formatDateTime(counter.last_session.closed_at)} with ${formatMoney(counter.last_session.closing_cash)}` : 'Not used yet' }}
              </div>
              <v-btn v-if="can('counters_cash_flow', 'Counter')" variant="text" color="primary" size="small" class="mt-2 px-0" prepend-icon="mdi-swap-vertical"
                @click="router.push(`/counters/${counter.id}/cash-flow`)">Cash flow</v-btn>
            </div>
          </v-col>
        </v-row>
      </UiParentCard>
    </v-col>

    <v-col v-if="can('sales_view', 'Sales')" cols="12" lg="8">
      <UiParentCard title="Today's Bills" icon="mdi-receipt-text-outline">
        <template #action>
          <v-btn variant="text" color="primary" size="small" @click="router.push('/bills')">View all</v-btn>
        </template>
        <v-table>
          <thead>
            <tr><th>Bill No</th><th>Time</th><th>Counter</th><th>Customer</th><th>Paid By</th><th class="text-right">Total</th></tr>
          </thead>
          <tbody>
            <tr v-for="bill in data.recent_bills" :key="bill.id" class="cursor-pointer" @click="router.push(`/bills/${bill.id}`)">
              <td class="font-weight-bold text-primary">
                {{ bill.bill_number }}
                <v-icon v-if="bill.pending_costs" size="16" color="error" title="Bought price pending">mdi-clock-alert-outline</v-icon>
              </td>
              <td>{{ formatDateTime(bill.created_at) }}</td>
              <td>{{ bill.counter?.name }}</td>
              <td>{{ bill.customer_name || 'Walk-in' }}</td>
              <td>{{ bill.payment_method }}</td>
              <td class="text-right font-weight-bold">{{ formatMoney(bill.total_amount) }}</td>
            </tr>
            <tr v-if="!data.recent_bills.length"><td colspan="6" class="text-center text-lightText py-6">No bills yet today</td></tr>
          </tbody>
        </v-table>
      </UiParentCard>
    </v-col>

    <v-col v-if="can('sales_view', 'Sales')" cols="12" lg="4">
      <UiParentCard title="Today's Payments" icon="mdi-cash-multiple">
        <v-table>
          <thead><tr><th>Type</th><th class="text-right">Amount</th><th class="text-right">Share</th></tr></thead>
          <tbody>
            <tr v-for="row in data.today.payments" :key="row.method">
              <td class="font-weight-bold">{{ row.method }}</td>
              <td class="text-right">{{ formatMoney(row.amount) }}</td>
              <td class="text-right">{{ paymentTotal ? formatNumber(row.amount * 100 / paymentTotal, 1) : 0 }}%</td>
            </tr>
            <tr>
              <td class="font-weight-bold">Total</td>
              <td class="text-right font-weight-bold">{{ formatMoney(paymentTotal) }}</td>
              <td></td>
            </tr>
          </tbody>
        </v-table>
      </UiParentCard>
    </v-col>

    <v-col v-if="can('products_view', 'Product')" cols="12">
      <UiParentCard title="Running Low" icon="mdi-alert-outline">
        <template #action>
          <v-btn variant="text" color="primary" size="small" @click="router.push('/products')">Products</v-btn>
        </template>
        <v-table>
          <thead><tr><th>Item</th><th class="text-right">In Stock</th><th class="text-right">Reorder At</th></tr></thead>
          <tbody>
            <tr v-for="(row, index) in data.low_stock" :key="index">
              <td><span class="font-weight-bold">{{ row.product_name }}</span> <span class="text-lightText">{{ row.variant_name }}</span></td>
              <td class="text-right text-error font-weight-bold">{{ formatNumber(row.stock, 3) }}</td>
              <td class="text-right">{{ formatNumber(row.reorder_level, 3) }}</td>
            </tr>
            <tr v-if="!data.low_stock.length"><td colspan="3" class="text-center text-lightText py-6">Nothing is running low</td></tr>
          </tbody>
        </v-table>
      </UiParentCard>
    </v-col>
  </v-row>
</template>

<style scoped>
.quick-action {
  text-transform: none;
  letter-spacing: 0;
  font-weight: 500;
}

.counter-card {
  height: 100%;
  padding: 14px 16px;
  border: 1px solid rgb(var(--v-theme-borderColor));
  border-radius: 12px;
  background: #fff;
}

.counter-card--open {
  border-color: rgba(var(--v-theme-success), 0.5);
  background: rgb(var(--v-theme-lightsuccess));
}
</style>
