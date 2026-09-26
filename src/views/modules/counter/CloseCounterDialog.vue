<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import axios from 'axios';
import RightDrawer from '@/components/shared/RightDrawer.vue';
import { useAlerts } from '@/composables/useAlerts';
import { usePendingStore } from '@/stores/pending';
import { can } from '@/utils/permissions';
import { formatDateTime, formatMoney } from '@/utils/api';

const props = defineProps<{
  modelValue: boolean;
  sessionId: number | null;
  readonly?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'closed', session: any): void;
  (e: 'cost-saved'): void;
}>();

const alerts = useAlerts();
const pending = usePendingStore();
const session = ref<any>(null);
const loading = ref(false);
const saving = ref(false);
const costs = ref<Record<number, number | string>>({});
const savingCost = ref<number | null>(null);
const closingCash = ref<number | string>('');
const note = ref('');

const isClosed = computed(() => session.value?.status === 'Closed');
const pendingItems = computed(() => session.value?.pending_items || []);
const canEnterCost = computed(() => can('pending_costs_edit', 'Pending Cost'));
const difference = computed(() => {
  if (closingCash.value === '' || !session.value) return null;
  return Math.round((Number(closingCash.value) - session.value.totals.cash_now) * 100) / 100;
});

async function load() {
  loading.value = true;
  alerts.clear();
  try {
    session.value = (await axios.get(`counter-sessions/${props.sessionId}`)).data;
    costs.value = {};
  } catch (error) {
    alerts.fail(error);
  } finally {
    loading.value = false;
  }
}

async function saveCost(item: any) {
  savingCost.value = item.id;
  try {
    await axios.put(`sale-items/${item.id}/cost`, { cost_price: costs.value[item.id] });
    await load();
    pending.refresh();
    emit('cost-saved');
  } catch (error) {
    alerts.fail(error);
  } finally {
    savingCost.value = null;
  }
}

async function submit() {
  if (props.readonly || isClosed.value) {
    emit('update:modelValue', false);
    return;
  }
  if (pendingItems.value.length) {
    alerts.fail(null, 'Enter every bought price first');
    return;
  }
  saving.value = true;
  try {
    const closed = (await axios.post(`counter-sessions/${props.sessionId}/close`, { closing_cash: closingCash.value === '' ? '' : Number(closingCash.value), note: note.value })).data;
    emit('closed', closed);
    emit('update:modelValue', false);
  } catch (error) {
    alerts.fail(error);
  } finally {
    saving.value = false;
  }
}

watch(() => props.modelValue, (open) => {
  if (open && props.sessionId) {
    closingCash.value = '';
    note.value = '';
    load();
  }
});
</script>

<template>
  <RightDrawer :model-value="modelValue" :title="isClosed || readonly ? 'Counter Summary' : 'Close Counter'" icon="mdi-lock-outline"
    :subtitle="session ? `${session.counter?.name} · ${session.session_number} · ${session.cashier?.full_name}` : ''"
    :submit-label="isClosed || readonly ? 'Done' : 'Close Counter'" max-width="640" :loading="saving"
    :show-error-alert="alerts.showErrorAlert.value" :error-text="alerts.errorText.value"
    @update:model-value="emit('update:modelValue', $event)" @submit="submit" @close-error="alerts.clear()">
    <v-skeleton-loader v-if="loading && !session" type="list-item@6" />
    <template v-else-if="session">
      <div v-if="!isClosed && pendingItems.length" class="pending-box mt-3">
        <div class="d-flex align-center ga-2 mb-1">
          <v-icon color="error">mdi-clock-alert-outline</v-icon>
          <span class="font-weight-bold text-error">Step 1 · Enter the bought price of {{ pendingItems.length }} item{{ pendingItems.length === 1 ? '' : 's' }}</span>
        </div>
        <p class="text-caption text-lightText mb-3">These were sold from another shopkeeper. The counter cannot close until each one has what you paid.</p>
        <div v-for="item in pendingItems" :key="item.id" class="pending-row">
          <div class="overflow-hidden">
            <div class="font-weight-semibold text-truncate">{{ item.product_name }}</div>
            <div class="text-caption text-lightText">{{ item.sale.bill_number }} · {{ item.quantity }} × {{ formatMoney(item.unit_price) }} sold</div>
          </div>
          <template v-if="canEnterCost">
            <v-text-field v-model="costs[item.id]" type="number" min="0" density="compact" hide-details placeholder="Bought price each" class="pending-row__input" />
            <v-btn color="primary" variant="flat" size="small" :loading="savingCost === item.id" :disabled="costs[item.id] === undefined || costs[item.id] === ''" @click="saveCost(item)">Save</v-btn>
          </template>
        </div>
        <v-alert v-if="!canEnterCost" type="info" variant="tonal" density="compact" class="mt-2">Ask the owner or manager to enter these prices.</v-alert>
      </div>

      <v-alert v-if="!isClosed && session.totals.due_promises?.length" type="warning" variant="tonal" density="compact" class="mt-4">
        <div class="font-weight-bold mb-1">
          {{ session.totals.due_promises.length }} bill{{ session.totals.due_promises.length === 1 ? '' : 's' }} promised for today {{ session.totals.due_promises.length === 1 ? 'is' : 'are' }} still unpaid
        </div>
        <div v-for="row in session.totals.due_promises" :key="row.id" class="text-caption">
          {{ row.bill_number }} · {{ row.customer_name || 'Walk-in' }} · {{ formatMoney(row.owing) }}
        </div>
        <div class="text-caption mt-1">You can still close the counter.</div>
      </v-alert>

      <div class="mt-4" :class="{ 'opacity-50': !isClosed && pendingItems.length }">
        <div class="text-subtitle-2 mb-2">{{ !isClosed && pendingItems.length ? 'Step 2 · Count the cash' : 'Cash in this counter' }}</div>
        <div class="cash-table">
          <div><span>Opened</span><span>{{ formatDateTime(session.opened_at) }}</span></div>
          <div><span>Opening cash</span><span>{{ formatMoney(session.opening_cash) }}</span></div>
          <div><span>Cash sales ({{ session.totals.bills }} bills)</span><span>+ {{ formatMoney(session.totals.cash_sales) }}</span></div>
          <div><span>Cash in</span><span>+ {{ formatMoney(session.totals.cash_in) }}</span></div>
          <div><span>Cash out</span><span>- {{ formatMoney(session.totals.cash_out) }}</span></div>
          <div v-if="session.totals.returns"><span>Cash refunds ({{ session.totals.returns }} returns)</span><span>- {{ formatMoney(session.totals.cash_refunds) }}</span></div>
          <div v-if="session.totals.khata_received_cash"><span>Khata payments taken</span><span>+ {{ formatMoney(session.totals.khata_received_cash) }}</span></div>
          <div class="cash-table__total"><span>Expected in counter</span><span>{{ formatMoney(isClosed ? session.expected_cash : session.totals.cash_now) }}</span></div>
          <div class="text-lightText"><span>Card / Online (not in counter)</span><span>{{ formatMoney(session.totals.card_sales) }} / {{ formatMoney(session.totals.online_sales) }}</span></div>
          <div v-if="session.totals.khata_sales" class="text-lightText"><span>Put on khata (not in counter)</span><span>{{ formatMoney(session.totals.khata_sales) }}</span></div>
          <template v-if="isClosed">
            <div><span>Counted</span><span>{{ formatMoney(session.closing_cash) }}</span></div>
            <div class="font-weight-bold" :class="session.cash_difference < 0 ? 'text-error' : 'text-successdark'">
              <span>{{ session.cash_difference < 0 ? 'Short' : session.cash_difference > 0 ? 'Over' : 'Balanced' }}</span>
              <span>{{ formatMoney(session.cash_difference) }}</span>
            </div>
          </template>
        </div>

        <div v-if="session.cash_moves?.length" class="mt-3">
          <div class="text-caption text-lightText mb-1">Cash in / out entries</div>
          <div v-for="move in session.cash_moves" :key="move.id" class="d-flex justify-space-between text-body-2 py-1 border-b">
            <span>{{ formatDateTime(move.created_at) }} · {{ move.reason }}<span v-if="move.note" class="text-lightText"> · {{ move.note }}</span></span>
            <span :class="move.type === 'In' ? 'text-successdark' : 'text-error'">{{ move.type === 'In' ? '+' : '-' }} {{ formatMoney(move.amount) }}</span>
          </div>
        </div>

        <template v-if="!isClosed && !readonly">
          <v-label class="text-subtitle-1 pb-2 text-lightText mt-4">Cash counted in counter</v-label>
          <v-text-field v-model="closingCash" type="number" min="0" hide-details :disabled="!!pendingItems.length" />
          <p v-if="difference !== null" class="mt-2 font-weight-semibold" :class="difference < 0 ? 'text-error' : difference > 0 ? 'text-orange' : 'text-successdark'">
            {{ difference === 0 ? 'Counter is balanced' : difference < 0 ? `Short by ${formatMoney(-difference)}` : `Over by ${formatMoney(difference)}` }}
          </p>
          <v-label class="text-subtitle-1 pb-2 text-lightText mt-3">Note</v-label>
          <v-textarea v-model="note" rows="2" hide-details placeholder="Reason for any difference" :disabled="!!pendingItems.length" />
        </template>
      </div>
    </template>
  </RightDrawer>
</template>

<style scoped>
.pending-box {
  padding: 14px;
  border: 1px solid rgba(var(--v-theme-error), 0.35);
  border-radius: 12px;
  background: rgb(var(--v-theme-lightred));
}

.pending-row {
  display: grid;
  grid-template-columns: 1fr 160px auto;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-top: 1px solid rgba(var(--v-theme-error), 0.15);
}

.pending-row__input {
  background: #fff;
}

.cash-table {
  border: 1px solid rgb(var(--v-theme-borderColor));
  border-radius: 10px;
  overflow: hidden;
}

.cash-table > div {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 7px 12px;
  border-bottom: 1px solid rgb(var(--v-theme-borderColor));
  font-size: 13.5px;
}

.cash-table > div:last-child {
  border-bottom: 0;
}

.cash-table__total {
  background: rgb(var(--v-theme-lightprimary));
  color: rgb(var(--v-theme-primary));
  font-weight: 700;
  font-size: 15px !important;
}
</style>
