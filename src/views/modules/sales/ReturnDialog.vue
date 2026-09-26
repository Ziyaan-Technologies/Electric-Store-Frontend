<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import axios from 'axios';
import RightDrawer from '@/components/shared/RightDrawer.vue';
import { useAlerts } from '@/composables/useAlerts';
import { formatMoney, formatNumber } from '@/utils/api';
import { round } from '@/utils/bill';

const props = defineProps<{
  modelValue: boolean;
  saleId: number | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'returned', result: any): void;
}>();

const alerts = useAlerts();
const sale = ref<any>(null);
const session = ref<any>(null);
const loading = ref(false);
const saving = ref(false);
const quantities = ref<Record<number, number | string>>({});
const refundMethod = ref('Cash');
const reason = ref('');

const reasons = ['Wrong size / rating', 'Faulty item', 'Customer changed mind', 'Extra quantity'];

const returnable = (item: any) => round(item.quantity - (item.returned_quantity || 0));

const refund = computed(() => {
  if (!sale.value) return 0;
  return round(sale.value.items.reduce((sum: number, item: any) => {
    const qty = Number(quantities.value[item.id]) || 0;
    return sum + (qty > 0 ? item.total * qty / item.quantity : 0);
  }, 0));
});

const counterReady = computed(() => !!session.value && !session.value.elsewhere);

function setQuantity(item: any, value: any) {
  const number = Math.max(0, Number(value) || 0);
  quantities.value[item.id] = Math.min(number, returnable(item));
}

function returnAll() {
  sale.value.items.forEach((item: any) => (quantities.value[item.id] = returnable(item)));
}

async function load() {
  loading.value = true;
  alerts.clear();
  try {
    sale.value = (await axios.get(`sales/${props.saleId}`)).data;
    session.value = (await axios.get('counter-sessions/current', { params: { clientstore_id: sale.value.clientstore_id } })).data;
    quantities.value = Object.fromEntries(sale.value.items.map((item: any) => [item.id, '']));
    refundMethod.value = sale.value.payment_method || 'Cash';
    reason.value = '';
  } catch (error) {
    alerts.fail(error);
  } finally {
    loading.value = false;
  }
}

async function submit() {
  const items = sale.value.items
    .map((item: any) => ({ sale_item_id: item.id, quantity: Number(quantities.value[item.id]) || 0 }))
    .filter((row: any) => row.quantity > 0);
  if (!items.length) {
    alerts.fail(null, 'Enter the quantity being returned');
    return;
  }
  if (!String(reason.value || '').trim()) {
    alerts.fail(null, 'Enter the reason for the return');
    return;
  }
  saving.value = true;
  try {
    const result = (await axios.post(`sales/${sale.value.id}/return`, { items, refund_method: refundMethod.value, reason: String(reason.value).trim() })).data;
    emit('returned', result);
    emit('update:modelValue', false);
  } catch (error) {
    alerts.fail(error);
  } finally {
    saving.value = false;
  }
}

watch(() => props.modelValue, (open) => {
  if (open && props.saleId) load();
});
</script>

<template>
  <RightDrawer :model-value="modelValue" title="Return Items" icon="mdi-keyboard-return"
    :subtitle="sale ? `Bill ${sale.bill_number} · stock goes back and the refund is recorded on your counter` : ''"
    :submit-label="`Return & Refund ${formatMoney(refund)}`" max-width="760" :loading="saving"
    :show-error-alert="alerts.showErrorAlert.value" :error-text="alerts.errorText.value"
    @update:model-value="emit('update:modelValue', $event)" @submit="submit" @close-error="alerts.clear()">
    <v-skeleton-loader v-if="loading && !sale" type="table" />
    <template v-else-if="sale">
      <v-alert v-if="!counterReady" type="warning" variant="tonal" density="compact" class="mt-3" icon="mdi-counter">
        {{ session?.elsewhere ? `Your counter is open in ${session.shop}.` : 'You have no open counter.' }} Open your counter in this shop on the Sell screen before making a return.
      </v-alert>
      <div v-else class="text-caption text-lightText mt-3">
        Refund from <strong>{{ session.counter?.name }}</strong> · cash in counter {{ formatMoney(session.totals.cash_now) }}
      </div>

      <div class="d-flex align-center justify-space-between mt-3 mb-2">
        <span class="text-subtitle-2">Items on this bill</span>
        <v-btn size="small" variant="tonal" color="primary" prepend-icon="mdi-select-all" @click="returnAll">Return everything</v-btn>
      </div>
      <div class="border rounded-md overflow-x-auto">
        <v-table density="comfortable">
          <thead>
            <tr><th>ITEM</th><th class="text-right">SOLD</th><th class="text-right">RETURNED</th><th class="text-center" style="width: 130px">RETURN NOW</th><th class="text-right">REFUND</th></tr>
          </thead>
          <tbody>
            <tr v-for="item in sale.items" :key="item.id" :class="{ 'text-lightText': !returnable(item) }">
              <td>
                <div class="font-weight-semibold">{{ item.product_name }}</div>
                <div class="text-caption text-lightText">{{ item.variant_name || (item.is_outside ? 'From another shopkeeper' : '') }} · {{ formatMoney(item.total / item.quantity) }} each after discount</div>
              </td>
              <td class="text-right">{{ formatNumber(item.quantity, 3) }}</td>
              <td class="text-right">{{ item.returned_quantity ? formatNumber(item.returned_quantity, 3) : '-' }}</td>
              <td class="text-center">
                <input v-if="returnable(item)" class="return-input" type="number" min="0" :max="returnable(item)" :value="quantities[item.id]" placeholder="0"
                  @input="setQuantity(item, ($event.target as HTMLInputElement).value)" />
                <span v-else class="text-caption">All returned</span>
              </td>
              <td class="text-right font-weight-bold">
                {{ Number(quantities[item.id]) > 0 ? formatMoney(item.total * Number(quantities[item.id]) / item.quantity) : '-' }}
              </td>
            </tr>
          </tbody>
        </v-table>
      </div>

      <v-row class="mt-2">
        <v-col cols="12" sm="6">
          <v-label class="text-subtitle-1 pb-2 text-lightText">Refund by</v-label>
          <v-btn-toggle v-model="refundMethod" mandatory color="primary" variant="outlined" divided density="comfortable" class="w-100">
            <v-btn value="Cash" class="flex-grow-1 text-none">Cash</v-btn>
            <v-btn value="Card" class="flex-grow-1 text-none">Card</v-btn>
            <v-btn value="Online" class="flex-grow-1 text-none">Online</v-btn>
          </v-btn-toggle>
        </v-col>
        <v-col cols="12" sm="6">
          <v-label class="text-subtitle-1 pb-2 text-lightText">Reason</v-label>
          <v-combobox v-model="reason" :items="reasons" placeholder="Why is it coming back?" hide-details />
        </v-col>
      </v-row>

      <div class="refund-total mt-4">
        <span>Refund to customer</span>
        <strong>{{ formatMoney(refund) }}</strong>
      </div>
      <p v-if="refundMethod === 'Cash'" class="text-caption text-lightText mt-2 mb-0">Cash refunds come out of your counter's cash.</p>
    </template>
  </RightDrawer>
</template>

<style scoped>
.return-input {
  width: 80px;
  height: 32px;
  border: 1px solid rgb(var(--v-theme-inputBorder));
  border-radius: 6px;
  text-align: center;
  font-weight: 600;
  outline: none;
  background: #fff;
}

.return-input:focus {
  border-color: rgb(var(--v-theme-primary));
}

.refund-total {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-radius: 12px;
  background: rgb(var(--v-theme-lighterror));
  color: rgb(var(--v-theme-error));
}

.refund-total strong {
  font-size: 22px;
}
</style>
