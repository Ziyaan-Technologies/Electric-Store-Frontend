<script setup lang="ts">
import { ref, watch } from 'vue';
import RightDrawer from '@/components/shared/RightDrawer.vue';
import { rules } from '@/utils/api';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'add', line: { product_name: string; unit_price: number }): void;
}>();

const drawerRef = ref<any>(null);
const form = ref({ product_name: '', unit_price: '' as number | string });

async function submit() {
  if (!(await drawerRef.value.validate())) return;
  emit('add', { product_name: form.value.product_name.trim(), unit_price: Number(form.value.unit_price) });
  emit('update:modelValue', false);
}

watch(() => props.modelValue, (open) => {
  if (open) {
    form.value = { product_name: '', unit_price: '' };
    drawerRef.value?.resetValidation();
  }
});
</script>

<template>
  <RightDrawer ref="drawerRef" :model-value="modelValue" title="Add a Charge" icon="mdi-cash-plus"
    subtitle="Money taken on the bill for somebody else, like mazdoori" submit-label="Add to Bill" max-width="420"
    @update:model-value="emit('update:modelValue', $event)" @submit="submit">
    <v-row>
      <v-col cols="12" class="pt-4">
        <v-label class="text-subtitle-1 pb-2 text-lightText">What is it for</v-label>
        <v-text-field v-model="form.product_name" :rules="[rules.required]" placeholder="e.g. Mazdoori" hide-details="auto" autofocus />
      </v-col>
      <v-col cols="12">
        <v-label class="text-subtitle-1 pb-2 text-lightText">Amount</v-label>
        <v-text-field v-model="form.unit_price" type="number" min="0" :rules="[rules.positive]" hide-details="auto" />
        <div class="text-caption text-lightText mt-1">It goes on the bill and into the counter, but not into profit.</div>
      </v-col>
    </v-row>
  </RightDrawer>
</template>
