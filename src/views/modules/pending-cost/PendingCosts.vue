<script setup lang="ts">
import { ref } from 'vue';
import axios from 'axios';
import UiParentCard from '@/components/shared/UiParentCard.vue';
import ListToolbar from '@/components/shared/ListToolbar.vue';
import TableBottom from '@/components/shared/TableBottom.vue';
import StatusChip from '@/components/shared/StatusChip.vue';
import { useListPage } from '@/composables/useListPage';
import { useAlerts } from '@/composables/useAlerts';
import { usePendingStore } from '@/stores/pending';
import { useAuthStore } from '@/stores/auth';
import { can } from '@/utils/permissions';
import { formatDateTime, formatMoney, formatNumber } from '@/utils/api';
import type { Header } from '@/models/type-interfaces';

const alerts = useAlerts();
const authStore = useAuthStore();
const pending = usePendingStore();
const status = ref<string | null>('Pending');
const costs = ref<Record<number, number | string>>({});
const shopkeepers = ref<Record<number, any>>({});
const creditors = ref<any[]>([]);
const saving = ref<number | null>(null);

const list = useListPage('pending-costs', {
  kpis: false,
  storeScoped: true,
  filters: () => ({ status: status.value || undefined }),
  onError: (error) => alerts.fail(error),
});

const headers = ref<Header[]>([
  { title: 'ID', align: 'start', key: 'id' },
  { title: 'ITEM', align: 'start', key: 'product_name' },
  { title: 'BILL', align: 'start', key: 'sale' },
  { title: 'COUNTER', align: 'start', key: 'counter' },
  { title: 'QTY', align: 'start', key: 'quantity' },
  { title: 'SOLD FOR', align: 'start', key: 'total' },
  { title: 'SHOPKEEPER', align: 'start', key: 'creditor', width: 220 },
  { title: 'BOUGHT PRICE (EACH)', align: 'start', key: 'cost_price', width: 240 },
  { title: 'PROFIT', align: 'start', key: 'profit' },
  { title: 'STATUS', align: 'start', key: 'status' },
]);

function profit(item: any) {
  const cost = item.cost_price ?? (costs.value[item.id] === '' || costs.value[item.id] === undefined ? null : Number(costs.value[item.id]));
  return cost === null ? null : item.total - cost * item.quantity;
}

async function loadCreditors() {
  try {
    creditors.value = (await axios.get('creditors/list', { params: { clientstore_id: authStore.clientstoreId } })).data;
  } catch (error) {
    creditors.value = [];
  }
}

async function save(item: any) {
  saving.value = item.id;
  try {
    await axios.put(`sale-items/${item.id}/cost`, {
      cost_price: costs.value[item.id],
      creditor_id: shopkeepers.value[item.id]?.id ?? item.creditor?.id ?? null,
    });
    alerts.success(`Bought price saved for ${item.product_name}`);
    delete costs.value[item.id];
    delete shopkeepers.value[item.id];
    list.refresh();
    pending.refresh();
  } catch (error) {
    alerts.fail(error);
  } finally {
    saving.value = null;
  }
}

loadCreditors();
</script>

<template>
  <v-row>
    <v-col cols="12">
      <UiParentCard>
        <v-alert v-model="alerts.showAlert.value" :text="alerts.alertText.value" type="success" density="compact" class="mb-4 single-line-alert" closable />
        <v-alert v-model="alerts.showErrorAlert.value" :text="alerts.errorText.value" type="error" density="compact" class="mb-4 single-line-alert" closable />

        <ListToolbar :total="list.totalItems.value" label="Items" search-placeholder="Search item, bill or customer..." @search="list.onSearch">
          <template #filters>
            <div>
              <v-select v-model="status" :items="['Pending', 'Entered']" placeholder="All" clearable hide-details @update:model-value="list.reload()" />
            </div>
          </template>
        </ListToolbar>

        <v-data-table :loading="list.loading.value" :items-per-page="list.itemsPerPage.value" :headers="headers" :items="list.items.value"
          item-value="id" hide-default-footer class="border rounded-md">
          <template v-slot:loading><v-skeleton-loader type="table-row@10"></v-skeleton-loader></template>
          <template v-slot:item.product_name="{ item }">
            <div class="font-weight-semibold">{{ item.product_name }}</div>
            <div class="text-caption text-lightText">{{ item.sale.customer_name || 'Walk-in' }}</div>
          </template>
          <template v-slot:item.sale="{ item }">
            <router-link :to="`/bills/${item.sale.id}`" class="text-primary font-weight-semibold text-decoration-none">{{ item.sale.bill_number }}</router-link>
            <div class="text-caption text-lightText">{{ formatDateTime(item.sale.created_at) }}</div>
          </template>
          <template v-slot:item.counter="{ item }">
            <div>{{ item.counter?.name }}</div>
            <div class="text-caption text-lightText">{{ item.cashier?.full_name }} · {{ item.session_status === 'Open' ? 'counter open' : 'counter closed' }}</div>
          </template>
          <template v-slot:item.quantity="{ item }">{{ formatNumber(item.quantity, 3) }} × {{ formatMoney(item.unit_price) }}</template>
          <template v-slot:item.total="{ item }"><span class="font-weight-semibold">{{ formatMoney(item.total) }}</span></template>
          <template v-slot:item.creditor="{ item }">
            <v-autocomplete v-if="item.cost_price === null && can('pending_costs_edit', 'Pending Cost')"
              :model-value="shopkeepers[item.id] ?? item.creditor" :items="creditors" item-title="name" item-value="id" return-object
              density="compact" hide-details clearable placeholder="Nobody" style="max-width: 200px"
              @update:model-value="(value: any) => shopkeepers[item.id] = value" />
            <span v-else-if="item.creditor" class="text-no-wrap">{{ item.creditor.name }}</span>
            <span v-else class="text-lightText">-</span>
          </template>
          <template v-slot:item.cost_price="{ item }">
            <div v-if="item.cost_price === null && can('pending_costs_edit', 'Pending Cost')" class="d-flex align-center ga-2 py-1">
              <v-text-field v-model="costs[item.id]" type="number" min="0" density="compact" hide-details placeholder="What you paid" style="max-width: 140px" />
              <v-btn color="primary" variant="flat" size="small" :loading="saving === item.id" :disabled="costs[item.id] === undefined || costs[item.id] === ''" @click="save(item)">Save</v-btn>
            </div>
            <span v-else-if="item.cost_price === null" class="text-error font-weight-bold">Pending</span>
            <div v-else>
              <div class="font-weight-semibold">{{ formatMoney(item.cost_price) }}</div>
              <div class="text-caption text-lightText">by {{ item.entered_by?.full_name }} · {{ formatDateTime(item.cost_entered_at) }}</div>
            </div>
          </template>
          <template v-slot:item.profit="{ item }">
            <span v-if="profit(item) === null" class="text-lightText">-</span>
            <span v-else :class="profit(item)! < 0 ? 'text-error font-weight-bold' : 'text-successdark font-weight-bold'">{{ formatMoney(profit(item)) }}</span>
          </template>
          <template v-slot:item.status="{ item }"><StatusChip :status="item.status" /></template>
          <template v-slot:no-data>
            <div class="py-6 text-center">
              <v-icon size="40" color="success">mdi-check-circle-outline</v-icon>
              <p class="mt-2 mb-0">{{ status === 'Pending' ? 'No bought prices are missing.' : 'No items found' }}</p>
            </div>
          </template>
          <template v-slot:bottom>
            <TableBottom v-model:page="list.currentPage.value" :page-count="list.pageCount.value" v-model:per-page="list.itemsPerPageInput.value" :total="list.totalItems.value" />
          </template>
        </v-data-table>
      </UiParentCard>
    </v-col>
  </v-row>
</template>
