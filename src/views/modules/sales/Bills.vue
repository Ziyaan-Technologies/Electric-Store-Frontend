<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import UiParentCard from '@/components/shared/UiParentCard.vue';
import DashboardStatCard from '@/components/shared/DashboardStatCard.vue';
import DatePickerRange from '@/components/shared/DatePickerRange.vue';
import ListToolbar from '@/components/shared/ListToolbar.vue';
import TableBottom from '@/components/shared/TableBottom.vue';
import PrintDialog from '@/components/shared/PrintDialog.vue';
import StatusChip from '@/components/shared/StatusChip.vue';
import ReturnDialog from './ReturnDialog.vue';
import { useListPage } from '@/composables/useListPage';
import { useAlerts } from '@/composables/useAlerts';
import { useLookups } from '@/composables/useLookups';
import { useCounterScope } from '@/composables/useCounterScope';
import { can } from '@/utils/permissions';
import { formatDateTime, formatMoney, formatNumber } from '@/utils/api';
import type { Header } from '@/models/type-interfaces';

const router = useRouter();
const alerts = useAlerts();
const lookups = useLookups();
const scope = useCounterScope();
const counterId = ref<number | null>(null);
const method = ref<string | null>(null);
const status = ref<string | null>(null);
const returnOpen = ref(false);
const returnSaleId = ref<number | null>(null);
const printKind = ref<'bill' | 'return'>('bill');
const dates = ref({ startDate: '', endDate: '' });
const printOpen = ref(false);
const printDoc = ref<any>(null);

const list = useListPage('sales', {
  storeScoped: true,
  filters: () => ({
    counter_id: counterId.value || undefined,
    payment_method: method.value || undefined,
    status: status.value || undefined,
    startDate: dates.value.startDate || undefined,
    endDate: dates.value.endDate || dates.value.startDate || undefined,
  }),
  onError: (error) => alerts.fail(error),
});

const headers = ref<Header[]>([
  { title: 'ID', align: 'start', key: 'id' },
  { title: 'BILL NO', align: 'start', key: 'bill_number' },
  { title: 'DATE', align: 'start', key: 'created_at' },
  // { title: 'COUNTER', align: 'start', key: 'counter' },
  { title: 'CASHIER', align: 'start', key: 'cashier' },
  { title: 'CUSTOMER', align: 'start', key: 'customer_name' },
  { title: 'ITEMS', align: 'start', key: 'item_count' },
  { title: 'DISCOUNT', align: 'start', key: 'discount' },
  { title: 'TOTAL', align: 'start', key: 'total_amount' },
  // { title: 'REFUNDED', align: 'start', key: 'refunded_amount' },
  // { title: 'PAID BY', align: 'start', key: 'payment_method' },
  { title: 'STATUS', align: 'start', key: 'status' },
  { title: 'ACTIONS', key: 'actions', sortable: false },
]);

const cards = computed(() => [
  { title: 'Net Sales', value: formatMoney(list.kpis.value.netSales), icon: 'mdi-cash-multiple', comparisonLabel: `${list.kpis.value.bills ?? 0} bills` },
  { title: 'Average Bill', value: formatMoney(list.kpis.value.averageBill), icon: 'mdi-receipt-text-outline', comparisonLabel: `${formatNumber(list.kpis.value.itemsSold, 2)} pcs sold` },
  { title: 'Refunds', value: formatMoney(list.kpis.value.refunds), icon: 'mdi-keyboard-return', showInfoIcon: (list.kpis.value.refunds ?? 0) > 0, comparisonLabel: `${list.kpis.value.returnedBills ?? 0} bills with returns · discounts ${formatMoney(list.kpis.value.discounts)}` },
  { title: list.kpis.value.provisional ? 'Profit (provisional)' : 'Profit', value: formatMoney(list.kpis.value.profit), icon: 'mdi-chart-line', showInfoIcon: !!list.kpis.value.provisional, comparisonLabel: list.kpis.value.provisional ? `${list.kpis.value.pendingItems} bought prices missing` : 'All bought prices entered' },
]);

function onDates(value: { startDate: string; endDate: string }) {
  dates.value = value;
  if (!value.startDate || value.endDate) list.reload();
}

async function print(item: any) {
  try {
    printDoc.value = (await axios.get(`sales/${item.id}`)).data;
    printKind.value = 'bill';
    printOpen.value = true;
  } catch (error) {
    alerts.fail(error);
  }
}

function openReturn(item: any) {
  returnSaleId.value = item.id;
  returnOpen.value = true;
}

function onReturned(result: any) {
  alerts.success(`Return ${result.return.return_number} saved · ${formatMoney(result.return.refund_amount)} refunded`);
  list.refresh();
  printDoc.value = { ...result.return, sale: result.sale, vendor: result.sale.vendor, clientstore: result.sale.clientstore };
  printKind.value = 'return';
  printOpen.value = true;
}

onMounted(() => lookups.loadCounters().catch((error) => alerts.fail(error)));
</script>

<template>
  <v-row>
    <v-col v-for="card in cards" :key="card.title" cols="12" sm="6" lg="3">
      <DashboardStatCard v-bind="card" />
    </v-col>
    <v-col cols="12">
      <UiParentCard>
        <v-alert v-model="alerts.showAlert.value" :text="alerts.alertText.value" type="success" density="compact" class="mb-4 single-line-alert" closable />
        <v-alert v-model="alerts.showErrorAlert.value" :text="alerts.errorText.value" type="error" density="compact" class="mb-4 single-line-alert" closable />
        <ListToolbar :total="list.totalItems.value" label="Total bills" search-placeholder="Search bill no, customer or phone..." @search="list.onSearch">
          <template #filters>
            <div v-if="scope.all.value">
              <v-select v-model="counterId" :items="lookups.counters.value" item-title="name" item-value="id" placeholder="All counters" clearable hide-details @update:model-value="list.reload()" />
            </div>
            <div>
              <v-select v-model="method" :items="['Cash', 'Card', 'Online']" placeholder="All payments" clearable hide-details @update:model-value="list.reload()" />
            </div>
            <div>
              <v-select v-model="status" :items="['Completed', 'Partially Returned', 'Returned']" placeholder="All statuses" clearable hide-details @update:model-value="list.reload()" />
            </div>
            <div>
              <DatePickerRange @update:selectedDates="onDates" />
            </div>
          </template>
        </ListToolbar>

        <v-data-table :loading="list.loading.value" :items-per-page="list.itemsPerPage.value" :headers="headers" :items="list.items.value"
          item-value="id" hide-default-footer class="border rounded-md">
          <template v-slot:loading><v-skeleton-loader type="table-row@10"></v-skeleton-loader></template>
          <template v-slot:item.bill_number="{ item }">
            <router-link :to="`/bills/${item.id}`" class="text-primary font-weight-semibold text-decoration-none">{{ item.bill_number }}</router-link>
            <v-icon v-if="item.pending_costs" size="16" color="error" class="ms-1" title="Bought price pending">mdi-clock-alert-outline</v-icon>
            <div v-if="item.quotation_id" class="text-caption text-lightText">from quotation</div>
          </template>
          <template v-slot:item.created_at="{ item }">{{ formatDateTime(item.created_at) }}</template>
          <!-- <template v-slot:item.counter="{ item }">{{ item.counter?.name }}</template> -->
          <template v-slot:item.cashier="{ item }">{{ item.cashier?.full_name }}</template>
          <template v-slot:item.customer_name="{ item }">
            <div>{{ item.customer_name || 'Walk-in' }}</div>
            <div class="text-caption text-lightText">{{ item.customer_phone }}</div>
          </template>
          <template v-slot:item.item_count="{ item }">{{ formatNumber(item.item_count, 3) }}</template>
          <template v-slot:item.discount="{ item }">{{ item.item_discount + item.bill_discount ? formatMoney(item.item_discount + item.bill_discount) : '-' }}</template>
          <template v-slot:item.total_amount="{ item }"><span class="font-weight-semibold">{{ formatMoney(item.total_amount) }}</span></template>
          <!-- <template v-slot:item.refunded_amount="{ item }"><span :class="item.refunded_amount > 0 ? 'text-error' : ''">{{ item.refunded_amount > 0 ? formatMoney(item.refunded_amount) : '-' }}</span></template> -->
          <template v-slot:item.status="{ item }"><StatusChip :status="item.status" /></template>
          <template v-slot:item.actions="{ item }">
            <div class="d-flex align-center ga-1">
              <v-btn icon="mdi-eye-outline" color="#EFF0F1" size="small" @click="router.push(`/bills/${item.id}`)" />
              <v-btn icon="mdi-printer" color="#EFF0F1" size="small" title="Print" @click="print(item)" />
              <v-btn v-if="can('pos_return', 'POS') && item.status !== 'Returned'" icon="mdi-keyboard-return" color="#FFEFEF" size="small" class="text-error" title="Return" @click="openReturn(item)" />
            </div>
          </template>
          <template v-slot:no-data><p class="px-2 py-2">No bills found</p></template>
          <template v-slot:bottom>
            <TableBottom v-model:page="list.currentPage.value" :page-count="list.pageCount.value" v-model:per-page="list.itemsPerPageInput.value" :total="list.totalItems.value" />
          </template>
        </v-data-table>
      </UiParentCard>
    </v-col>
  </v-row>

  <PrintDialog v-model="printOpen" :doc="printDoc" :kind="printKind" />
  <ReturnDialog v-model="returnOpen" :sale-id="returnSaleId" @returned="onReturned" />
</template>
