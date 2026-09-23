<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import RightDrawer from '@/components/shared/RightDrawer.vue';
import { formatMoney } from '@/utils/api';
import { round, type DiscountType } from '@/utils/bill';

const props = defineProps<{
  modelValue: boolean;
  lines: { name: string; total: number }[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'apply', discount: { type: DiscountType; value: number }): void;
}>();

const type = ref<DiscountType>('percent');
const value = ref<number | string>('');
const error = ref('');

const base = computed(() => round(props.lines.reduce((sum, line) => sum + line.total, 0)));
const amount = computed(() => {
  const number = Math.max(0, Number(value.value) || 0);
  return round(Math.min(base.value, type.value === 'percent' ? base.value * Math.min(number, 100) / 100 : number));
});

function submit() {
  const number = Number(value.value);
  if (!(number > 0)) {
    error.value = 'Enter a discount above zero';
    return;
  }
  if (type.value === 'percent' && number > 100) {
    error.value = 'Percent cannot be more than 100';
    return;
  }
  emit('apply', { type: type.value, value: number });
  emit('update:modelValue', false);
}

watch(() => props.modelValue, (open) => {
  if (open) {
    type.value = 'percent';
    value.value = '';
    error.value = '';
  }
});
</script>

<template>
  <RightDrawer :model-value="modelValue" title="Bill Discount" icon="mdi-sale-outline" subtitle="Applies only to the items on the bill right now"
    submit-label="Apply Discount" max-width="500" :show-error-alert="!!error" :error-text="error"
    @update:model-value="emit('update:modelValue', $event)" @submit="submit" @close-error="error = ''">
    <v-row>
      <v-col cols="12" class="pt-4">
        <v-btn-toggle v-model="type" mandatory color="primary" variant="outlined" divided density="comfortable" class="w-100">
          <v-btn value="percent" class="flex-grow-1">Percent (%)</v-btn>
          <v-btn value="amount" class="flex-grow-1">Amount (Rs)</v-btn>
        </v-btn-toggle>
      </v-col>
      <v-col cols="12">
        <v-label class="text-subtitle-1 pb-2 text-lightText">{{ type === 'percent' ? 'Discount %' : 'Discount amount' }}</v-label>
        <v-text-field v-model="value" type="number" min="0" hide-details autofocus :suffix="type === 'percent' ? '%' : ''" />
      </v-col>
      <v-col cols="12">
        <div class="border rounded-md">
          <div class="d-flex justify-space-between px-3 py-2 bg-grey100 text-subtitle-2">
            <span>Covers these {{ lines.length }} item{{ lines.length === 1 ? '' : 's' }}</span>
            <span>{{ formatMoney(base) }}</span>
          </div>
          <div class="discount-lines">
            <div v-for="(line, index) in lines" :key="index" class="d-flex justify-space-between px-3 py-1 text-body-2">
              <span class="text-truncate me-2">{{ line.name }}</span><span>{{ formatMoney(line.total) }}</span>
            </div>
          </div>
          <div class="d-flex justify-space-between px-3 py-2 border-t font-weight-bold text-primary">
            <span>Discount</span><span>- {{ formatMoney(amount) }}</span>
          </div>
        </div>
        <p class="text-caption text-lightText mt-2 mb-0">Items you add after this will not get this discount. Raising the quantity of a covered item keeps the discount.</p>
      </v-col>
    </v-row>
  </RightDrawer>
</template>

<style scoped>
.discount-lines {
  max-height: 180px;
  overflow-y: auto;
}
</style>
