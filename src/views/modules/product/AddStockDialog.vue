<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import axios from 'axios';
import RightDrawer from '@/components/shared/RightDrawer.vue';
import { useAlerts } from '@/composables/useAlerts';
import { formatMoney, formatNumber } from '@/utils/api';
import { round } from '@/utils/bill';

const props = defineProps<{ modelValue: boolean; product: any }>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'saved', product: any): void;
}>();

const alerts = useAlerts();
const drawerRef = ref<any>(null);
const saving = ref(false);
const form = ref<any>({ variant_id: null, quantity: '', cost_price: '', supplier: '', note: '' });

const sizes = computed(() => (props.product?.variants || []).map((variant: any) => ({
  value: variant.id,
  title: variant.name,
  variant,
})));

const chosen = computed(() => (props.product?.variants || []).find((variant: any) => variant.id === form.value.variant_id) || null);
const quantity = computed(() => Number(form.value.quantity) || 0);
const price = computed(() => Number(form.value.cost_price) || 0);

const newCost = computed(() => {
  if (!chosen.value || quantity.value <= 0 || price.value <= 0) return null;
  const held = Math.max(Number(chosen.value.stock) || 0, 0);
  return round((held * Number(chosen.value.cost_price) + quantity.value * price.value) / (held + quantity.value));
});

async function submit() {
  if (!(await drawerRef.value.validate())) return;
  saving.value = true;
  try {
    const data = (await axios.post(`products/${props.product.id}/stock`, {
      variant_id: form.value.variant_id,
      quantity: quantity.value,
      cost_price: price.value,
      supplier: form.value.supplier?.trim() || '',
      note: form.value.note?.trim() || '',
    })).data;
    emit('saved', data);
    emit('update:modelValue', false);
  } catch (error) {
    alerts.fail(error);
  } finally {
    saving.value = false;
  }
}

watch(() => props.modelValue, (open) => {
  if (open) {
    form.value = { variant_id: props.product?.variants?.[0]?.id || null, quantity: '', cost_price: '', supplier: '', note: '' };
    alerts.clear();
    drawerRef.value?.resetValidation();
  }
});
</script>

<template>
  <RightDrawer ref="drawerRef" :model-value="modelValue" title="Add Stock" icon="mdi-package-down"
    :subtitle="product?.name" submit-label="Add Stock" max-width="520" :loading="saving"
    :show-error-alert="alerts.showErrorAlert.value" :error-text="alerts.errorText.value"
    @update:model-value="emit('update:modelValue', $event)" @submit="submit" @close-error="alerts.clear()">
    <v-row>
      <v-col cols="12" class="pt-4">
        <v-label class="text-subtitle-1 pb-2 text-lightText">Size</v-label>
        <v-select v-model="form.variant_id" :items="sizes" :rules="[(v: any) => !!v || 'Pick a size']" hide-details="auto" />
      </v-col>
      <v-col cols="12" sm="6">
        <v-label class="text-subtitle-1 pb-2 text-lightText">Pieces coming in</v-label>
        <v-text-field v-model="form.quantity" type="number" min="0" :rules="[(v: any) => Number(v) > 0 || 'Enter the pieces']" hide-details="auto" autofocus />
      </v-col>
      <v-col cols="12" sm="6">
        <v-label class="text-subtitle-1 pb-2 text-lightText">Price you paid (each)</v-label>
        <v-text-field v-model="form.cost_price" type="number" min="0" :rules="[(v: any) => Number(v) > 0 || 'Enter the price']" hide-details="auto" />
      </v-col>
      <v-col cols="12" sm="6">
        <v-label class="text-subtitle-1 pb-2 text-lightText">Came from</v-label>
        <v-text-field v-model="form.supplier" placeholder="Shop or supplier" hide-details />
      </v-col>
      <v-col cols="12" sm="6">
        <v-label class="text-subtitle-1 pb-2 text-lightText">Note</v-label>
        <v-text-field v-model="form.note" placeholder="Optional" hide-details />
      </v-col>
      <v-col v-if="chosen" cols="12">
        <div class="stock-preview">
          <div><span>Stock now</span><strong>{{ formatNumber(chosen.stock, 3) }}</strong></div>
          <div><span>After this</span><strong class="text-primary">{{ formatNumber(chosen.stock + quantity, 3) }}</strong></div>
          <div><span>Cost now</span><strong>{{ formatMoney(chosen.cost_price) }}</strong></div>
          <div><span>Average cost after</span><strong class="text-primary">{{ newCost === null ? '-' : formatMoney(newCost) }}</strong></div>
        </div>
      </v-col>
    </v-row>
  </RightDrawer>
</template>

<style scoped>
.stock-preview {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.stock-preview > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 14px;
  border: 1px solid rgb(var(--v-theme-borderColor));
  border-radius: 10px;
}

.stock-preview span {
  font-size: 12px;
  color: rgb(var(--v-theme-lightText));
}

.stock-preview strong {
  font-size: 16px;
}
</style>
