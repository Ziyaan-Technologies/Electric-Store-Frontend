<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import UiParentCard from '@/components/shared/UiParentCard.vue';
import DatePickerRange from '@/components/shared/DatePickerRange.vue';
import ListToolbar from '@/components/shared/ListToolbar.vue';
import TableBottom from '@/components/shared/TableBottom.vue';
import StatusChip from '@/components/shared/StatusChip.vue';
import PrintDialog from '@/components/shared/PrintDialog.vue';
import { useListPage } from '@/composables/useListPage';
import { useAlerts } from '@/composables/useAlerts';
import { useLookups } from '@/composables/useLookups';
import { useCounterScope } from '@/composables/useCounterScope';
import { can } from '@/utils/permissions';
import { formatDate, formatDateTime, formatMoney, formatNumber } from '@/utils/api';
import type { Header } from '@/models/type-interfaces';

const router = useRouter();
const alerts = useAlerts();
const lookups = useLookups();
const scope = useCounterScope();
const counterId = ref<number | null>(null);
const status = ref<string | null>(null);
const dates = ref({ startDate: '', endDate: '' });
const printOpen = ref(false);
const printDoc = ref<any>(null);

const list = useListPage('quotations', {
  kpis: false,
  storeScoped: true,
  filters: () => ({
    counter_id: counterId.value || undefined,
    status: status.value || undefined,
    startDate: dates.value.startDate || undefined,
    endDate: dates.value.endDate || dates.value.startDate || undefined,
  }),
  onError: (error) => alerts.fail(error),
});

const headers = ref<Header[]>([
  { title: 'ID', align: 'start', key: 'id' },
  { title: 'QUOTATION NO', align: 'start', key: 'quotation_number' },
  { title: 'DATE', align: 'start', key: 'created_at' },
  { title: 'COUNTER', align: 'start', key: 'counter' },
  { title: 'CUSTOMER', align: 'start', key: 'customer_name' },
  { title: 'ITEMS', align: 'start', key: 'item_count' },
  { title: 'TOTAL', align: 'start', key: 'total_amount' },
  { title: 'VALID UNTIL', align: 'start', key: 'valid_until' },
  { title: 'STATUS', align: 'start', key: 'status' },
  { title: 'ACTIONS', key: 'actions', sortable: false },
]);

function onDates(value: { startDate: string; endDate: string }) {
  dates.value = value;
  if (!value.startDate || value.endDate) list.reload();
}

async function print(item: any) {
  try {
    printDoc.value = (await axios.get(`quotations/${item.id}`)).data;
    printOpen.value = true;
  } catch (error) {
    alerts.fail(error);
  }
}

function convert(item: any) {
  router.push({ path: '/pos', query: { quotation: item.id } });
}

onMounted(() => lookups.loadCounters().catch((error) => alerts.fail(error)));
</script>

<template>
  <v-row>
    <v-col cols="12">
      <UiParentCard>
        <v-alert v-model="alerts.showErrorAlert.value" :text="alerts.errorText.value" type="error" density="compact" class="mb-4 single-line-alert" closable />
        <ListToolbar :total="list.totalItems.value" label="Quotations" search-placeholder="Search number, customer or phone..."
          add-label="New Quotation" :can-add="can('pos_sell', 'POS')" @search="list.onSearch" @add="router.push('/pos')">
          <template #filters>
            <div v-if="scope.all.value">
              <v-select v-model="counterId" :items="lookups.counters.value" item-title="name" item-value="id" placeholder="All counters" clearable hide-details @update:model-value="list.reload()" />
            </div>
            <div>
              <v-select v-model="status" :items="['Open', 'Converted', 'Expired']" placeholder="All statuses" clearable hide-details @update:model-value="list.reload()" />
            </div>
            <div>
              <DatePickerRange @update:selectedDates="onDates" />
            </div>
          </template>
        </ListToolbar>

        <v-data-table :loading="list.loading.value" :items-per-page="list.itemsPerPage.value" :headers="headers" :items="list.items.value"
          item-value="id" hide-default-footer class="border rounded-md">
          <template v-slot:loading><v-skeleton-loader type="table-row@10"></v-skeleton-loader></template>
          <template v-slot:item.quotation_number="{ item }">
            <router-link :to="`/quotations/${item.id}`" class="text-primary font-weight-semibold text-decoration-none">{{ item.quotation_number }}</router-link>
            <div v-if="!item.show_item_prices" class="text-caption text-lightText">total only</div>
          </template>
          <template v-slot:item.created_at="{ item }">
            <div>{{ formatDateTime(item.created_at) }}</div>
            <div class="text-caption text-lightText">by {{ item.created_by_user?.full_name }}</div>
          </template>
          <template v-slot:item.counter="{ item }">{{ item.counter?.name || '-' }}</template>
          <template v-slot:item.customer_name="{ item }">
            <div>{{ item.customer_name || 'Walk-in' }}</div>
            <div class="text-caption text-lightText">{{ item.customer_phone }}</div>
          </template>
          <template v-slot:item.item_count="{ item }">{{ formatNumber(item.item_count, 3) }}</template>
          <template v-slot:item.total_amount="{ item }"><span class="font-weight-semibold">{{ formatMoney(item.total_amount) }}</span></template>
          <template v-slot:item.valid_until="{ item }">{{ formatDate(item.valid_until) }}</template>
          <template v-slot:item.status="{ item }">
            <StatusChip :status="item.status" />
            <div v-if="item.sale" class="text-caption"><router-link :to="`/bills/${item.sale.id}`" class="text-primary">{{ item.sale.bill_number }}</router-link></div>
          </template>
          <template v-slot:item.actions="{ item }">
            <div class="d-flex align-center ga-1">
              <v-btn icon="mdi-eye-outline" color="#EFF0F1" size="small" @click="router.push(`/quotations/${item.id}`)" />
              <v-btn icon="mdi-printer" color="#EFF0F1" size="small" title="Print" @click="print(item)" />
              <v-btn v-if="item.status === 'Open' && can('quotations_convert', 'Quotation') && can('pos_sell', 'POS')" color="primary" variant="tonal" size="small"
                prepend-icon="mdi-receipt-text-check-outline" @click="convert(item)">Convert to Bill</v-btn>
            </div>
          </template>
          <template v-slot:no-data><p class="px-2 py-2">No quotations found</p></template>
          <template v-slot:bottom>
            <TableBottom v-model:page="list.currentPage.value" :page-count="list.pageCount.value" v-model:per-page="list.itemsPerPageInput.value" :total="list.totalItems.value" />
          </template>
        </v-data-table>
      </UiParentCard>
    </v-col>
  </v-row>

  <PrintDialog v-model="printOpen" :doc="printDoc" kind="quotation" />
</template>
