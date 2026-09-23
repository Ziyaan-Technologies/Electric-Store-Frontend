<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import RightDrawer from '@/components/shared/RightDrawer.vue';
import { formatMoney } from '@/utils/api';
import { round } from '@/utils/bill';

const props = defineProps<{
  modelValue: boolean;
  total: number;
  saving: boolean;
  errorText: string;
  debtor?: any;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'confirm', payment: { payment_method: string; amount_received: number; paid_amount: number }): void;
  (e: 'close-error'): void;
}>();

const methods = [
  { value: 'Cash', icon: 'mdi-cash' },
  { value: 'Card', icon: 'mdi-credit-card-outline' },
  { value: 'Online', icon: 'mdi-cellphone-nfc' },
];
const method = ref('Cash');
const received = ref<number | string>('');
const payNow = ref<number | string>('');

const due = computed(() => (props.debtor ? round(Math.min(Math.max(Number(payNow.value) || 0, 0), props.total)) : props.total));
const toKhata = computed(() => round(props.total - due.value));

const quick = computed(() => {
  const values = [due.value, Math.ceil(due.value / 100) * 100, Math.ceil(due.value / 500) * 500, Math.ceil(due.value / 1000) * 1000, Math.ceil(due.value / 5000) * 5000];
  return [...new Set(values)].filter((value) => value >= due.value).slice(0, 4);
});

const change = computed(() => round((Number(received.value) || 0) - due.value));

function submit() {
  emit('confirm', {
    payment_method: method.value,
    amount_received: method.value === 'Cash' ? Number(received.value || due.value) : due.value,
    paid_amount: due.value,
  });
}

watch(() => props.modelValue, (open) => {
  if (open) {
    method.value = 'Cash';
    received.value = '';
    payNow.value = props.debtor ? 0 : props.total;
  }
});
</script>

<template>
  <RightDrawer :model-value="modelValue" title="Take Payment" icon="mdi-cash-register" submit-label="Save Bill" max-width="520"
    :loading="saving" :show-error-alert="!!errorText" :error-text="errorText"
    @update:model-value="emit('update:modelValue', $event)" @submit="submit" @close-error="emit('close-error')">
    <div class="pay-total mt-3">
      <span>Bill total</span>
      <strong>{{ formatMoney(total) }}</strong>
    </div>

    <template v-if="debtor">
      <div class="pay-khata mt-4">
        <v-icon size="20" class="me-2">mdi-account-cash-outline</v-icon>
        <span class="flex-grow-1">{{ debtor.name }}<template v-if="debtor.balance"> · owes {{ formatMoney(debtor.balance) }}</template></span>
      </div>
      <v-label class="text-subtitle-1 pb-2 text-lightText mt-4">Paying now</v-label>
      <v-text-field v-model="payNow" type="number" min="0" :max="total" placeholder="0" hide-details autofocus />
      <div class="d-flex flex-wrap ga-2 mt-2">
        <v-chip variant="outlined" color="primary" @click="payNow = 0">Nothing now</v-chip>
        <v-chip variant="outlined" color="primary" @click="payNow = total">Full amount</v-chip>
      </div>
      <div class="pay-split mt-3">
        <div><span>Paid now</span><strong>{{ formatMoney(due) }}</strong></div>
        <div><span>To khata</span><strong :class="toKhata > 0 ? 'text-error' : ''">{{ formatMoney(toKhata) }}</strong></div>
      </div>
    </template>

    <div v-if="due > 0" class="pay-methods mt-4">
      <button v-for="item in methods" :key="item.value" type="button" class="pay-method" :class="{ 'pay-method--active': method === item.value }" @click="method = item.value">
        <v-icon size="26">{{ item.icon }}</v-icon>
        <span>{{ item.value }}</span>
      </button>
    </div>
    <template v-if="due > 0 && method === 'Cash'">
      <v-label class="text-subtitle-1 pb-2 text-lightText mt-4">Cash received</v-label>
      <v-text-field v-model="received" type="number" min="0" :placeholder="String(due)" hide-details :autofocus="!debtor" />
      <div class="d-flex flex-wrap ga-2 mt-2">
        <v-chip v-for="value in quick" :key="value" variant="outlined" color="primary" @click="received = value">{{ formatMoney(value) }}</v-chip>
      </div>
      <div v-if="received !== ''" class="pay-change mt-3" :class="change < 0 ? 'pay-change--short' : ''">
        <span>{{ change < 0 ? 'Still to pay' : 'Change to give' }}</span>
        <strong>{{ formatMoney(Math.abs(change)) }}</strong>
      </div>
    </template>
    <v-alert v-else-if="due > 0" type="info" variant="tonal" density="compact" class="mt-4">
      {{ method }} payments are not counted in the counter's cash.
    </v-alert>
  </RightDrawer>
</template>

<style scoped>
.pay-total {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-radius: 12px;
  background: rgb(var(--v-theme-lightprimary));
  color: rgb(var(--v-theme-primary));
}

.pay-total strong {
  font-size: 26px;
}

.pay-methods {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.pay-method {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 8px;
  border: 1px solid rgb(var(--v-theme-borderColor));
  border-radius: 12px;
  background: #fff;
  font-weight: 600;
  color: rgb(var(--v-theme-textPrimary));
}

.pay-method--active {
  border-color: rgb(var(--v-theme-primary));
  background: rgb(var(--v-theme-primary));
  color: #fff;
}

.pay-change {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  border-radius: 10px;
  background: rgb(var(--v-theme-lightsuccess));
  color: rgb(var(--v-theme-successdark));
}

.pay-change strong {
  font-size: 20px;
}

.pay-change--short {
  background: rgb(var(--v-theme-lighterror));
  color: rgb(var(--v-theme-error));
}

.pay-khata {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  border-radius: 10px;
  background: rgb(var(--v-theme-lightwarning));
  color: rgb(var(--v-theme-warning));
  font-weight: 600;
}

.pay-split {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.pay-split > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 14px;
  border: 1px solid rgb(var(--v-theme-borderColor));
  border-radius: 10px;
}

.pay-split span {
  font-size: 12px;
  color: rgb(var(--v-theme-lightText));
}

.pay-split strong {
  font-size: 18px;
}
</style>
