<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';
import UiParentCard from '@/components/shared/UiParentCard.vue';
import DashboardStatCard from '@/components/shared/DashboardStatCard.vue';
import StatusChip from '@/components/shared/StatusChip.vue';
import { useAlerts } from '@/composables/useAlerts';
import { useLookups } from '@/composables/useLookups';
import { formatDate, formatDateTime, formatMoney, today } from '@/utils/api';

const route = useRoute();
const router = useRouter();
const alerts = useAlerts();
const lookups = useLookups();
const date = ref(String(route.query.date || today()));
const data = ref<any>(null);
const loading = ref(true);

const counterId = computed(() => Number(route.params.id));

const cards = computed(() => {
  if (!data.value) return [];
  const summary = data.value.summary;
  return [
    { title: 'Opening Cash', value: formatMoney(summary.opening), icon: 'mdi-lock-open-variant-outline', comparisonLabel: `${data.value.sessions.length} session${data.value.sessions.length === 1 ? '' : 's'}` },
    { title: 'Cash In', value: formatMoney(summary.cash_sales + summary.cash_in), icon: 'mdi-arrow-down-bold-circle-outline', comparisonLabel: `Sales ${formatMoney(summary.cash_sales)} · added ${formatMoney(summary.cash_in)}` },
    { title: 'Cash Out', value: formatMoney(summary.cash_out + summary.cash_refunds), icon: 'mdi-arrow-up-bold-circle-outline', comparisonLabel: `Taken out ${formatMoney(summary.cash_out)} · refunds ${formatMoney(summary.cash_refunds)}`, showInfoIcon: summary.cash_out + summary.cash_refunds > 0 },
    { title: summary.counted === null ? 'Cash in Counter Now' : 'Counted at Close', value: formatMoney(summary.counted ?? summary.expected), icon: 'mdi-cash-register',
      comparisonLabel: summary.difference === null ? `Card ${formatMoney(summary.card_sales)} · Online ${formatMoney(summary.online_sales)}` : `Expected ${formatMoney(summary.expected)} · ${summary.difference === 0 ? 'balanced' : summary.difference < 0 ? `short ${formatMoney(-summary.difference)}` : `over ${formatMoney(summary.difference)}`}`,
      showInfoIcon: !!summary.difference },
  ];
});

const typeColors: Record<string, string> = {
  'Opening': 'primary',
  'Sale': 'success',
  'Cash In': 'success',
  'Cash Out': 'error',
  'Refund': 'error',
  'Closing': 'secondary',
};

async function load() {
  loading.value = true;
  try {
    data.value = (await axios.get(`counters/${counterId.value}/cash-flow`, { params: { date: date.value } })).data;
  } catch (error) {
    alerts.fail(error);
  } finally {
    loading.value = false;
  }
}

function shiftDay(days: number) {
  const value = new Date(`${date.value}T12:00:00`);
  value.setDate(value.getDate() + days);
  date.value = `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function switchCounter(id: number) {
  router.replace({ path: `/counters/${id}/cash-flow`, query: { date: date.value } });
}

watch(date, () => {
  router.replace({ query: { date: date.value } });
  load();
});
watch(counterId, load);

onMounted(() => {
  load();
  lookups.loadCounters().catch(() => undefined);
});
</script>

<template>
  <v-alert v-model="alerts.showErrorAlert.value" :text="alerts.errorText.value" type="error" density="compact" class="mb-4 single-line-alert" closable />
  <div class="d-flex align-center flex-wrap ga-3 mb-4">
    <v-select :model-value="counterId" :items="lookups.counters.value" item-title="name" item-value="id" hide-details density="comfortable" style="max-width: 220px"
      prepend-inner-icon="mdi-counter" @update:model-value="switchCounter" />
    <v-btn icon="mdi-chevron-left" variant="outlined" size="small" @click="shiftDay(-1)" />
    <v-text-field v-model="date" type="date" hide-details density="comfortable" style="max-width: 200px" />
    <v-btn icon="mdi-chevron-right" variant="outlined" size="small" :disabled="date >= today()" @click="shiftDay(1)" />
    <v-btn variant="text" color="primary" :disabled="date === today()" @click="date = today()">Today</v-btn>
    <v-spacer />
    <v-btn variant="outlined" color="primary" prepend-icon="mdi-arrow-left" to="/counters">Counters</v-btn>
  </div>

  <v-skeleton-loader v-if="loading && !data" type="card, table" class="border rounded-lg" />
  <template v-else-if="data">
    <v-row>
      <v-col v-for="card in cards" :key="card.title" cols="12" sm="6" lg="3">
        <DashboardStatCard v-bind="card" />
      </v-col>
    </v-row>

    <UiParentCard v-if="!data.sessions.length" :title="`${data.counter.name} · ${formatDate(data.date)}`" icon="mdi-swap-vertical" class="mt-5">
      <p class="text-center text-lightText py-8 mb-0">This counter was not opened on this day.</p>
    </UiParentCard>

    <UiParentCard v-for="session in data.sessions" :key="session.id" :title="`${data.counter.name} · ${session.session_number}`" icon="mdi-swap-vertical" class="mt-5">
      <template #action>
        <StatusChip :status="session.status" />
        <span class="text-caption text-lightText">{{ session.cashier?.full_name }} · {{ formatDateTime(session.opened_at) }}{{ session.closed_at ? ` → ${formatDateTime(session.closed_at)}` : '' }}</span>
      </template>
      <div class="border rounded-md overflow-x-auto">
        <v-table density="comfortable">
          <thead>
            <tr><th>TIME</th><th>TYPE</th><th>DETAIL</th><th>BY</th><th class="text-right">IN</th><th class="text-right">OUT</th><th class="text-right">CASH IN COUNTER</th></tr>
          </thead>
          <tbody>
            <tr v-for="(entry, index) in session.entries" :key="index" :class="{ 'text-lightText': !entry.in_drawer && entry.type !== 'Closing' }">
              <td class="text-no-wrap">{{ formatDateTime(entry.time) }}</td>
              <td><v-chip size="small" :color="entry.in_drawer || entry.type === 'Closing' ? typeColors[entry.type] : undefined" variant="tonal">{{ !entry.in_drawer && entry.method ? `${entry.type} · ${entry.method}` : entry.type }}</v-chip></td>
              <td>
                <router-link v-if="entry.sale_id" :to="`/bills/${entry.sale_id}`" class="text-primary text-decoration-none">{{ entry.label }}</router-link>
                <span v-else>{{ entry.label }}</span>
                <div v-if="entry.method && !entry.in_drawer" class="text-caption">Not in counter cash</div>
              </td>
              <td>{{ entry.by?.full_name }}</td>
              <td class="text-right text-successdark">{{ entry.type !== 'Closing' && entry.amount > 0 ? formatMoney(entry.amount) : '' }}</td>
              <td class="text-right text-error">{{ entry.amount < 0 ? formatMoney(-entry.amount) : '' }}</td>
              <td class="text-right font-weight-bold">{{ formatMoney(entry.balance) }}</td>
            </tr>
          </tbody>
        </v-table>
      </div>
      <div class="flow-summary mt-4">
        <div><span>Opening</span><strong>{{ formatMoney(session.opening_cash) }}</strong></div>
        <div><span>+ Cash sales</span><strong>{{ formatMoney(session.totals.cash_sales) }}</strong></div>
        <div><span>+ Cash in</span><strong>{{ formatMoney(session.totals.cash_in) }}</strong></div>
        <div><span>- Cash out</span><strong>{{ formatMoney(session.totals.cash_out) }}</strong></div>
        <div v-if="session.totals.returns"><span>- Cash refunds</span><strong>{{ formatMoney(session.totals.cash_refunds) }}</strong></div>
        <div class="flow-summary__main"><span>= Expected</span><strong>{{ formatMoney(session.status === 'Closed' ? session.expected_cash : session.totals.cash_now) }}</strong></div>
        <div v-if="session.status === 'Closed'"><span>Counted</span><strong>{{ formatMoney(session.closing_cash) }}</strong></div>
        <div v-if="session.status === 'Closed'" :class="session.cash_difference < 0 ? 'text-error' : session.cash_difference > 0 ? 'text-orange' : 'text-successdark'">
          <span>{{ session.cash_difference < 0 ? 'Short' : session.cash_difference > 0 ? 'Over' : 'Balanced' }}</span><strong>{{ formatMoney(session.cash_difference) }}</strong>
        </div>
        <div class="text-lightText"><span>Card / Online</span><strong>{{ formatMoney(session.totals.card_sales) }} / {{ formatMoney(session.totals.online_sales) }}</strong></div>
      </div>
      <p v-if="session.note" class="text-caption text-lightText mt-2 mb-0">Close note: {{ session.note }}</p>
    </UiParentCard>
  </template>
</template>

<style scoped>
.flow-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.flow-summary > div {
  display: flex;
  flex-direction: column;
  min-width: 120px;
  padding: 10px 14px;
  border: 1px solid rgb(var(--v-theme-borderColor));
  border-radius: 10px;
}

.flow-summary span {
  font-size: 12px;
}

.flow-summary strong {
  font-size: 16px;
}

.flow-summary__main {
  border-color: rgb(var(--v-theme-primary)) !important;
  background: rgb(var(--v-theme-lightprimary));
  color: rgb(var(--v-theme-primary));
}
</style>
