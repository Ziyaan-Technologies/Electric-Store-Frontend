<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import { useAlerts } from '@/composables/useAlerts';
import { formatDateTime, formatMoney, formatNumber } from '@/utils/api';

const props = defineProps<{ modelValue: boolean; product: any }>();
const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void }>();

const router = useRouter();
const alerts = useAlerts();
const loading = ref(false);
const data = ref<any>(null);
const variantId = ref<number | null>(null);

async function load() {
  loading.value = true;
  try {
    data.value = (await axios.get(`products/${props.product.id}/history`, {
      params: { variant_id: variantId.value || undefined },
    })).data;
  } catch (error) {
    alerts.fail(error);
  } finally {
    loading.value = false;
  }
}

function openBill(row: any) {
  emit('update:modelValue', false);
  router.push(`/bills/${row.sale_id}`);
}

watch(() => props.modelValue, (open) => {
  if (open) {
    variantId.value = null;
    alerts.clear();
    load();
  }
});
</script>

<template>
  <v-dialog :model-value="modelValue" max-width="1000" scrollable @update:model-value="emit('update:modelValue', $event)">
    <v-card class="ui-modal">
      <div class="ui-modal__header">
        <div>
          <span class="ui-modal__title">Item History</span>
          <div class="ui-modal__subtitle">{{ product?.name }}</div>
        </div>
        <button class="ui-modal__close" type="button" aria-label="Close item history" @click="emit('update:modelValue', false)">
          <v-icon size="18">mdi-close</v-icon>
        </button>
      </div>

      <v-card-text class="ui-modal__body">
        <v-alert v-model="alerts.showErrorAlert.value" :text="alerts.errorText.value" type="error" density="compact" class="mb-4 single-line-alert" closable />

        <v-select v-model="variantId" :items="[{ value: null, title: 'All sizes' }, ...(product?.variants || []).map((v: any) => ({ value: v.id, title: v.name }))]"
          hide-details class="mb-4 bold-field" @update:model-value="load" />

        <v-skeleton-loader v-if="loading" type="table-row@6" />

        <template v-else-if="data">
          <div class="history-totals mb-4">
            <div><span>Pieces in</span><strong>{{ formatNumber(data.totals.pieces_in, 3) }}</strong></div>
            <div><span>Pieces sold</span><strong>{{ formatNumber(data.totals.pieces_sold, 3) }}</strong></div>
            <div><span>Stock left</span><strong>{{ formatNumber(data.totals.stock_left, 3) }}</strong></div>
            <div><span>Money spent</span><strong>{{ formatMoney(data.totals.spent) }}</strong></div>
            <div><span>Money earned</span><strong>{{ formatMoney(data.totals.earned) }}</strong></div>
            <div><span>Profit</span><strong :class="data.totals.profit >= 0 ? 'text-success' : 'text-error'">{{ formatMoney(data.totals.profit) }}</strong></div>
          </div>

          <v-table class="border rounded-md">
            <thead>
              <tr>
                <th class="text-left">WHAT</th>
                <th class="text-left">DATE</th>
                <th class="text-left">SIZE</th>
                <th class="text-right">PIECES</th>
                <th class="text-right">PRICE</th>
                <th class="text-right">AMOUNT</th>
                <th class="text-right">PROFIT</th>
                <th class="text-left">DETAILS</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in data.rows" :key="row.id">
                <td>
                  <v-chip size="small" variant="tonal" :color="row.kind === 'Out' ? 'primary' : row.kind === 'Correction' ? 'warning' : 'success'">
                    {{ row.kind === 'Out' ? 'Sold' : row.kind === 'Correction' ? 'Cost changed' : 'Came in' }}
                  </v-chip>
                </td>
                <td class="text-no-wrap">{{ formatDateTime(row.created_at) }}</td>
                <td>{{ row.variant_name }}</td>
                <td class="text-right">
                  {{ formatNumber(row.quantity, 3) }}
                  <div v-if="row.returned_quantity" class="text-caption text-error">{{ formatNumber(row.returned_quantity, 3) }} returned</div>
                </td>
                <td class="text-right">{{ formatMoney(row.price) }}</td>
                <td class="text-right">{{ formatMoney(row.amount) }}</td>
                <td class="text-right">
                  <span v-if="row.kind !== 'Out'" class="text-lightText">-</span>
                  <span v-else-if="row.profit === null" class="text-warning">Cost pending</span>
                  <span v-else class="font-weight-bold" :class="row.profit >= 0 ? 'text-success' : 'text-error'">{{ formatMoney(row.profit) }}</span>
                </td>
                <td>
                  <template v-if="row.kind !== 'Out'">
                    <div class="text-caption">Stock {{ formatNumber(row.stock_after, 3) }} · cost {{ formatMoney(row.cost_after) }}</div>
                    <div v-if="row.supplier || row.note" class="text-caption text-lightText">{{ [row.supplier, row.note].filter(Boolean).join(' · ') }}</div>
                    <div v-if="row.by" class="text-caption text-lightText">by {{ row.by }}</div>
                  </template>
                  <template v-else>
                    <a class="history-bill" @click="openBill(row)">{{ row.bill_number }}</a>
                    <div class="text-caption text-lightText">{{ row.counter }} · {{ row.by }}</div>
                  </template>
                </td>
              </tr>
              <tr v-if="!data.rows.length"><td colspan="8" class="text-center text-lightText py-6">Nothing has come in or gone out yet</td></tr>
            </tbody>
          </v-table>
        </template>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.history-totals {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 10px;
}

.history-totals > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border: 1px solid rgb(var(--v-theme-borderColor));
  border-radius: 10px;
}

.history-totals span {
  font-size: 12px;
  color: rgb(var(--v-theme-lightText));
}

.history-totals strong {
  font-size: 16px;
}

.history-bill {
  font-weight: 700;
  color: rgb(var(--v-theme-primary));
  cursor: pointer;
}

@media (max-width: 959px) {
  .history-totals {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
