<script setup lang="ts">
import { ref, watch } from 'vue';
import RightDrawer from '@/components/shared/RightDrawer.vue';
import { formatMoney } from '@/utils/api';

const props = defineProps<{
  modelValue: boolean;
  total: number;
  customerName: string;
  customerPhone: string;
  saving: boolean;
  errorText: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'confirm', data: { customer_name: string; customer_phone: string; valid_until: string; show_item_prices: boolean; note: string }): void;
  (e: 'close-error'): void;
}>();

function inDays(days: number) {
  const date = new Date(Date.now() + days * 86400000);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const form = ref({ customer_name: '', customer_phone: '', valid_until: inDays(7), show_item_prices: true, note: '' });

function submit() {
  emit('confirm', { ...form.value });
}

watch(() => props.modelValue, (open) => {
  if (open) {
    form.value = { customer_name: props.customerName, customer_phone: props.customerPhone, valid_until: inDays(7), show_item_prices: true, note: '' };
  }
});
</script>

<template>
  <RightDrawer :model-value="modelValue" title="Save Quotation" icon="mdi-file-document-edit-outline"
    subtitle="Does not take payment or reduce stock" submit-label="Save & Print" max-width="560"
    :loading="saving" :show-error-alert="!!errorText" :error-text="errorText"
    @update:model-value="emit('update:modelValue', $event)" @submit="submit" @close-error="emit('close-error')">
    <v-row>
      <v-col cols="12" class="pt-4">
        <div class="d-flex justify-space-between align-center pa-3 rounded-lg bg-lightprimary text-primary">
          <span class="font-weight-semibold">Quotation total</span>
          <span class="text-h5 font-weight-bold">{{ formatMoney(total) }}</span>
        </div>
      </v-col>
      <v-col cols="12" sm="6">
        <v-label class="text-subtitle-1 pb-2 text-lightText">Customer name</v-label>
        <v-text-field v-model="form.customer_name" hide-details placeholder="Optional" />
      </v-col>
      <v-col cols="12" sm="6">
        <v-label class="text-subtitle-1 pb-2 text-lightText">Phone</v-label>
        <v-text-field v-model="form.customer_phone" hide-details placeholder="Optional" />
      </v-col>
      <v-col cols="12" sm="6">
        <v-label class="text-subtitle-1 pb-2 text-lightText">Valid until</v-label>
        <v-text-field v-model="form.valid_until" type="date" hide-details />
      </v-col>
      <v-col cols="12" sm="6" class="d-flex align-end">
        <div class="border rounded-md px-3 py-1 w-100 d-flex align-center justify-space-between">
          <div>
            <div class="text-subtitle-2">Show item prices</div>
            <div class="text-caption text-lightText">{{ form.show_item_prices ? 'Each item with its price' : 'Items and quantities, total only' }}</div>
          </div>
          <v-switch v-model="form.show_item_prices" color="primary" hide-details density="compact" />
        </div>
      </v-col>
      <v-col cols="12">
        <v-label class="text-subtitle-1 pb-2 text-lightText">Note</v-label>
        <v-textarea v-model="form.note" rows="2" auto-grow hide-details placeholder="e.g. Delivery in 3 days" />
      </v-col>
    </v-row>
  </RightDrawer>
</template>
