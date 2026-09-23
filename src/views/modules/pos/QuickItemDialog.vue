<script setup lang="ts">
import { ref, watch } from 'vue';
import RightDrawer from '@/components/shared/RightDrawer.vue';
import { rules } from '@/utils/api';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'add', line: { product_name: string; quantity: number; unit_price: number }): void;
}>();

const drawerRef = ref<any>(null);
const form = ref({ product_name: '', quantity: 1, unit_price: '' as number | string });

async function submit() {
  if (!(await drawerRef.value.validate())) return;
  emit('add', { product_name: form.value.product_name.trim(), quantity: Number(form.value.quantity), unit_price: Number(form.value.unit_price) });
  emit('update:modelValue', false);
}

watch(() => props.modelValue, (open) => {
  if (open) {
    form.value = { product_name: '', quantity: 1, unit_price: '' };
    drawerRef.value?.resetValidation();
  }
});
</script>

<template>
  <RightDrawer ref="drawerRef" :model-value="modelValue" title="Item From Another Shopkeeper" icon="mdi-account-arrow-left-outline"
    subtitle="Sell it now, enter what you paid for it before closing the counter" submit-label="Add to Bill" max-width="480"
    @update:model-value="emit('update:modelValue', $event)" @submit="submit">
    <v-row>
      <v-col cols="12" class="pt-4">
        <v-label class="text-subtitle-1 pb-2 text-lightText">Item name</v-label>
        <v-text-field v-model="form.product_name" :rules="[rules.required]" placeholder="e.g. 4mm copper wire" hide-details="auto" autofocus />
      </v-col>
      <v-col cols="6">
        <v-label class="text-subtitle-1 pb-2 text-lightText">Quantity</v-label>
        <v-text-field v-model.number="form.quantity" type="number" min="1" :rules="[rules.positive]" hide-details="auto" />
      </v-col>
      <v-col cols="6">
        <v-label class="text-subtitle-1 pb-2 text-lightText">Selling price (each)</v-label>
        <v-text-field v-model="form.unit_price" type="number" min="0" :rules="[rules.positive]" hide-details="auto" />
      </v-col>
      <v-col cols="12">
        <v-alert type="warning" variant="tonal" density="compact" icon="mdi-clock-alert-outline">
          The bought price stays <strong>pending</strong>. This counter cannot close until someone enters it.
        </v-alert>
      </v-col>
    </v-row>
  </RightDrawer>
</template>
