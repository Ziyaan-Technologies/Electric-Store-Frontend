<script setup lang="ts">
import { ref, watch } from 'vue';
import axios from 'axios';
import RightDrawer from '@/components/shared/RightDrawer.vue';
import { useAlerts } from '@/composables/useAlerts';
import { can } from '@/utils/permissions';
import { formatMoney, rules } from '@/utils/api';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'add', line: { product_name: string; quantity: number; unit_price: number; creditor_id: number | null; creditor_name: string }): void;
}>();

const alerts = useAlerts();
const drawerRef = ref<any>(null);
const form = ref({ product_name: '', quantity: 1, unit_price: '' as number | string });
const creditor = ref<any>(null);
const creditors = ref<any[]>([]);
const creditorSearch = ref('');
const loadingCreditors = ref(false);
const adding = ref(false);

async function findCreditors(term: string) {
  loadingCreditors.value = true;
  try {
    creditors.value = (await axios.get('creditors/list', { params: { search: term || undefined } })).data;
  } catch (error) {
    creditors.value = [];
  } finally {
    loadingCreditors.value = false;
  }
}

async function addCreditor() {
  const name = creditorSearch.value.trim();
  if (!name) return;
  adding.value = true;
  try {
    const saved = (await axios.post('creditors', { name })).data;
    creditors.value = [saved, ...creditors.value];
    creditor.value = saved;
  } catch (error) {
    alerts.fail(error);
  } finally {
    adding.value = false;
  }
}

async function submit() {
  if (!(await drawerRef.value.validate())) return;
  emit('add', {
    product_name: form.value.product_name.trim(),
    quantity: Number(form.value.quantity),
    unit_price: Number(form.value.unit_price),
    creditor_id: creditor.value?.id || null,
    creditor_name: creditor.value?.name || '',
  });
  emit('update:modelValue', false);
}

watch(() => props.modelValue, (open) => {
  if (open) {
    form.value = { product_name: '', quantity: 1, unit_price: '' };
    creditor.value = null;
    creditorSearch.value = '';
    alerts.clear();
    findCreditors('');
    drawerRef.value?.resetValidation();
  }
});
</script>

<template>
  <RightDrawer ref="drawerRef" :model-value="modelValue" title="Item From Another Shopkeeper" icon="mdi-account-arrow-left-outline"
    subtitle="Sell it now, enter what you paid for it before closing the counter" submit-label="Add to Bill" max-width="480"
    :show-error-alert="alerts.showErrorAlert.value" :error-text="alerts.errorText.value"
    @update:model-value="emit('update:modelValue', $event)" @submit="submit" @close-error="alerts.clear()">
    <v-row>
      <v-col cols="12" class="pt-4">
        <v-label class="text-subtitle-1 pb-2 text-lightText">Whose shop is it from?</v-label>
        <v-autocomplete v-model="creditor" :items="creditors" :loading="loadingCreditors" item-title="name" item-value="id" return-object
          density="compact" hide-details clearable no-filter placeholder="Optional · search a shopkeeper" prepend-inner-icon="mdi-store-search-outline"
          v-model:search="creditorSearch" autofocus @update:search="findCreditors" @focus="findCreditors(creditorSearch)">
          <template v-slot:item="{ props: itemProps, item }">
            <v-list-item v-bind="itemProps" :title="item.raw.name" :subtitle="item.raw.phone || ''">
              <template v-slot:append>
                <span class="text-caption font-weight-bold" :class="item.raw.balance > 0 ? 'text-error' : 'text-success'">{{ formatMoney(item.raw.balance) }}</span>
              </template>
            </v-list-item>
          </template>
          <template v-slot:no-data>
            <div class="px-4 py-3">
              <p class="mb-0 text-lightText">{{ creditorSearch ? 'No shopkeeper by that name' : 'Type a name to search' }}</p>
              <v-btn v-if="creditorSearch && can('creditors_create', 'Creditors')" variant="text" color="primary" size="small" class="px-0 text-none"
                prepend-icon="mdi-plus" :loading="adding" @click="addCreditor">Add "{{ creditorSearch }}"</v-btn>
            </div>
          </template>
        </v-autocomplete>
        <div class="text-caption text-lightText mt-1">The bought price goes on his khata as money we owe him.</div>
      </v-col>
      <v-col cols="12">
        <v-label class="text-subtitle-1 pb-2 text-lightText">Item name</v-label>
        <v-text-field v-model="form.product_name" :rules="[rules.required]" placeholder="e.g. 4mm copper wire" hide-details="auto" />
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
