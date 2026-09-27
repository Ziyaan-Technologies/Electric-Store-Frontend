<script setup lang="ts">
import { ref } from 'vue';
import axios from 'axios';
import UiParentCard from '@/components/shared/UiParentCard.vue';
import DashboardStatCard from '@/components/shared/DashboardStatCard.vue';
import ListToolbar from '@/components/shared/ListToolbar.vue';
import TableBottom from '@/components/shared/TableBottom.vue';
import DatePickerRange from '@/components/shared/DatePickerRange.vue';
import { useListPage } from '@/composables/useListPage';
import { useLookups } from '@/composables/useLookups';
import { useAlerts } from '@/composables/useAlerts';
import { useAuthStore } from '@/stores/auth';
import { formatDate, formatDateTime, formatMoney } from '@/utils/api';
import type { Header } from '@/models/type-interfaces';

const authStore = useAuthStore();
const alerts = useAlerts();
const lookups = useLookups();
const counterId = ref<number | null>(null);
const dates = ref<{ startDate: string; endDate: string }>({ startDate: '', endDate: '' });

const list = useListPage('expenses', {
  storeScoped: true,
  filters: () => ({
    counter_id: counterId.value || undefined,
    startDate: dates.value.startDate || undefined,
    endDate: dates.value.endDate || dates.value.startDate || undefined,
  }),
  onError: (error) => alerts.fail(error),
});

const headers = ref<Header[]>([
  { title: 'DATE', align: 'start', key: 'date' },
  { title: 'ENTRIES', align: 'start', key: 'entries' },
  { title: 'COUNTERS', align: 'start', key: 'counters' },
  { title: 'TOTAL', align: 'start', key: 'total' },
  { title: '', key: 'actions', sortable: false },
]);

const dayOpen = ref(false);
const dayLoading = ref(false);
const day = ref<any>(null);

const cards = ref<any[]>([]);

function buildCards() {
  const kpis = list.kpis.value;
  cards.value = [
    { title: 'Today', value: formatMoney(kpis.today ?? 0), icon: 'mdi-cash-minus', comparisonLabel: `${kpis.todayCount ?? 0} expense${kpis.todayCount === 1 ? '' : 's'}` },
    { title: 'This Month', value: formatMoney(kpis.month ?? 0), icon: 'mdi-calendar-month-outline', comparisonLabel: `${kpis.monthCount ?? 0} entries` },
  ];
}

async function openDay(row: any) {
  dayOpen.value = true;
  dayLoading.value = true;
  day.value = null;
  try {
    day.value = (await axios.get('expenses/day', { params: { clientstore_id: authStore.clientstoreId, date: row.date } })).data;
  } catch (error) {
    alerts.fail(error);
  } finally {
    dayLoading.value = false;
  }
}

function onDates(value: any) {
  dates.value = { startDate: value?.startDate || '', endDate: value?.endDate || '' };
  list.reload();
}

lookups.loadCounters();
setTimeout(buildCards, 400);
</script>

<template>
  <v-row>
    <v-col v-for="card in cards" :key="card.title" cols="12" sm="6" lg="4">
      <DashboardStatCard v-bind="card" />
    </v-col>

    <v-col cols="12">
      <UiParentCard>
        <ListToolbar :total="list.totalItems.value" label="Days" search-placeholder="Search what it was spent on..."
          @search="(value) => { list.onSearch(value); buildCards(); }">
          <template #filters>
            <div>
              <v-select v-model="counterId" :items="lookups.counters.value" item-title="name" item-value="id" placeholder="All counters" clearable hide-details
                @update:model-value="() => { list.reload(); buildCards(); }" />
            </div>
            <div>
              <DatePickerRange @update:selectedDates="onDates" />
            </div>
          </template>
        </ListToolbar>

        <v-data-table :loading="list.loading.value" :items-per-page="list.itemsPerPage.value" :headers="headers" :items="list.items.value"
          item-value="date" hide-default-footer class="border rounded-md">
          <template v-slot:loading><v-skeleton-loader type="table-row@8"></v-skeleton-loader></template>
          <template v-slot:top>
            <v-alert v-model="alerts.showErrorAlert.value" :text="alerts.errorText.value" type="error" density="compact" class="mb-4 single-line-alert" closable />
          </template>
          <template v-slot:item.date="{ item }">
            <span class="text-subtitle-2">{{ formatDate(item.date) }}</span>
          </template>
          <template v-slot:item.counters="{ item }">
            <span v-if="item.counters?.length">{{ item.counters.join(', ') }}</span>
            <span v-else class="text-lightText">-</span>
          </template>
          <template v-slot:item.total="{ item }">
            <span class="font-weight-bold text-error">{{ formatMoney(item.total) }}</span>
          </template>
          <template v-slot:item.actions="{ item }">
            <v-btn variant="text" color="primary" size="small" class="text-none" append-icon="mdi-chevron-right" @click="openDay(item)">See the day</v-btn>
          </template>
          <template v-slot:no-data><p class="px-2 py-2">No expenses in this period</p></template>
          <template v-slot:bottom>
            <TableBottom v-model:page="list.currentPage.value" :page-count="list.pageCount.value" v-model:per-page="list.itemsPerPageInput.value" :total="list.totalItems.value" />
          </template>
        </v-data-table>
      </UiParentCard>
    </v-col>
  </v-row>

  <v-dialog v-model="dayOpen" max-width="820" scrollable>
    <v-card class="ui-modal">
      <div class="ui-modal__header">
        <div>
          <span class="ui-modal__title">Expenses</span>
          <div class="text-caption" style="color: rgba(255, 255, 255, 0.85)">{{ day ? formatDate(day.date) : '' }}</div>
        </div>
        <button class="ui-modal__close" type="button" aria-label="Close" @click="dayOpen = false"><v-icon size="18">mdi-close</v-icon></button>
      </div>
      <v-card-text class="ui-modal__body">
        <v-skeleton-loader v-if="dayLoading" type="table-row@5" />
        <template v-else-if="day">
          <v-table density="comfortable" class="border rounded-md">
            <thead>
              <tr><th>TIME</th><th>SPENT ON</th><th>COUNTER</th><th>BY</th><th class="text-right">AMOUNT</th></tr>
            </thead>
            <tbody>
              <tr v-for="row in day.expenses" :key="row.id">
                <td class="text-no-wrap">{{ formatDateTime(row.time).split(', ')[1] }}</td>
                <td>{{ row.note }}</td>
                <td>{{ row.counter?.name }}</td>
                <td>{{ row.by?.full_name }}</td>
                <td class="text-right font-weight-bold">{{ formatMoney(row.amount) }}</td>
              </tr>
              <tr v-if="!day.expenses.length"><td colspan="5" class="text-center text-lightText py-6">Nothing was spent on this day</td></tr>
            </tbody>
            <tfoot v-if="day.expenses.length">
              <tr>
                <td colspan="4" class="text-right font-weight-bold">Total spent</td>
                <td class="text-right font-weight-bold text-error">{{ formatMoney(day.total) }}</td>
              </tr>
            </tfoot>
          </v-table>

          <template v-if="day.other_cash_out.length">
            <div class="text-subtitle-2 mt-5 mb-2">Other cash out that day · {{ formatMoney(day.other_total) }}</div>
            <v-table density="compact" class="border rounded-md">
              <tbody>
                <tr v-for="row in day.other_cash_out" :key="row.id">
                  <td class="text-no-wrap">{{ formatDateTime(row.time).split(', ')[1] }}</td>
                  <td>{{ row.reason }}<span v-if="row.note" class="text-lightText"> · {{ row.note }}</span></td>
                  <td>{{ row.counter?.name }}</td>
                  <td class="text-right">{{ formatMoney(row.amount) }}</td>
                </tr>
              </tbody>
            </v-table>
          </template>
        </template>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>
