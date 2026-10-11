<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import axios from 'axios';
import RightDrawer from '@/components/shared/RightDrawer.vue';
import { useAlerts } from '@/composables/useAlerts';
import { useAuthStore } from '@/stores/auth';
import { formatMoney, rules } from '@/utils/api';

const props = defineProps<{
  modelValue: boolean;
  sessionId: number | null;
  type: 'In' | 'Out';
  cashNow: number;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'saved', session: any): void;
}>();

const alerts = useAlerts();
const authStore = useAuthStore();
const drawerRef = ref<any>(null);
const saving = ref(false);
const form = ref({ reason: '', amount: '' as number | string, note: '' });
const creditor = ref<any>(null);
const creditors = ref<any[]>([]);
const loadingCreditors = ref(false);
const debtor = ref<any>(null);
const debtors = ref<any[]>([]);
const loadingDebtors = ref(false);

const reasons = computed(() => (props.type === 'In'
  ? ['Change money added', 'Owner put cash in', 'Other']
  : ['Shop expense', 'Paid another shopkeeper', 'Paid to debtor', 'Owner took cash', 'Bank deposit', 'Other']));

const isExpense = computed(() => form.value.reason === 'Shop expense');
const isSupplier = computed(() => form.value.reason === 'Paid another shopkeeper');
const isDebtor = computed(() => form.value.reason === 'Paid to debtor');

const debtorSearch = ref('');

async function loadDebtors(term = '') {
  loadingDebtors.value = true;
  try {
    debtors.value = (await axios.get('debtors/list', { params: { clientstore_id: authStore.clientstoreId, search: term || undefined } })).data;
  } catch (error) {
    debtors.value = [];
  } finally {
    loadingDebtors.value = false;
  }
}

const creditorSearch = ref('');

async function loadCreditors(term = '') {
  loadingCreditors.value = true;
  try {
    creditors.value = (await axios.get('creditors/list', { params: { clientstore_id: authStore.clientstoreId, search: term || undefined } })).data;
  } catch (error) {
    creditors.value = [];
  } finally {
    loadingCreditors.value = false;
  }
}

const after = computed(() => props.cashNow + (props.type === 'In' ? 1 : -1) * (Number(form.value.amount) || 0));

async function submit() {
  if (!(await drawerRef.value.validate())) return;
  saving.value = true;
  try {
    const session = (await axios.post(`counter-sessions/${props.sessionId}/cash-moves`, {
      type: props.type,
      ...form.value,
      amount: Number(form.value.amount),
      creditor_id: isSupplier.value ? creditor.value?.id || null : null,
      debtor_id: isDebtor.value ? debtor.value?.id || null : null,
    })).data;
    emit('saved', session);
    emit('update:modelValue', false);
  } catch (error) {
    alerts.fail(error);
  } finally {
    saving.value = false;
  }
}

watch(() => props.modelValue, (open) => {
  if (open) {
    form.value = { reason: reasons.value[0], amount: '', note: '' };
    creditor.value = null;
    debtor.value = null;
    alerts.clear();
    drawerRef.value?.resetValidation();
    if (props.type === 'Out') {
      loadCreditors();
      loadDebtors();
    }
  }
});
</script>

<template>
  <RightDrawer ref="drawerRef" :model-value="modelValue" :title="type === 'In' ? 'Cash In' : 'Cash Out'" :icon="type === 'In' ? 'mdi-cash-plus' : 'mdi-cash-minus'"
    :subtitle="type === 'In' ? 'Money put into the counter' : 'Money taken out of the counter'" :submit-label="type === 'In' ? 'Add Cash' : 'Take Cash Out'"
    max-width="480" :loading="saving" :show-error-alert="alerts.showErrorAlert.value" :error-text="alerts.errorText.value"
    @update:model-value="emit('update:modelValue', $event)" @submit="submit" @close-error="alerts.clear()">
    <v-row>
      <v-col cols="12" class="pt-4">
        <v-label class="text-subtitle-1 pb-2 text-lightText">Reason</v-label>
        <v-select v-model="form.reason" :items="reasons" :rules="[rules.requiredSelect]" hide-details="auto" />
      </v-col>
      <v-col v-if="isSupplier" cols="12">
        <v-label class="text-subtitle-1 pb-2 text-lightText">Which shopkeeper</v-label>
        <v-autocomplete v-model="creditor" :items="creditors" :loading="loadingCreditors" item-title="name" item-value="id" return-object no-filter
          v-model:search="creditorSearch" @update:search="loadCreditors" @focus="loadCreditors(creditorSearch)"
          :rules="[(v: any) => !!v || 'Choose the shopkeeper']" placeholder="Type a name or phone" prepend-inner-icon="mdi-store-search-outline" hide-details="auto">
          <template v-slot:item="{ props: itemProps, item }">
            <v-list-item v-bind="itemProps" :title="item.raw.name" :subtitle="item.raw.phone || ''">
              <template v-slot:append>
                <span class="text-caption font-weight-bold" :class="item.raw.balance > 0 ? 'text-error' : 'text-success'">{{ formatMoney(item.raw.balance) }}</span>
              </template>
            </v-list-item>
          </template>
          <template v-slot:no-data><p class="px-4 py-3 mb-0 text-lightText">{{ creditorSearch ? 'No shopkeeper by that name' : 'Type a name to search' }}</p></template>
        </v-autocomplete>
        <div v-if="creditor" class="text-caption text-lightText mt-1">
          {{ creditor.balance > 0 ? `We owe him ${formatMoney(creditor.balance)}` : `He is holding an advance of ${formatMoney(creditor.advance)}` }} · this payment goes off his khata.
        </div>
      </v-col>
      <v-col v-if="isDebtor" cols="12">
        <v-label class="text-subtitle-1 pb-2 text-lightText">Which customer</v-label>
        <v-autocomplete v-model="debtor" :items="debtors" :loading="loadingDebtors" item-title="name" item-value="id" return-object no-filter
          v-model:search="debtorSearch" @update:search="loadDebtors" @focus="loadDebtors(debtorSearch)"
          :rules="[(v: any) => !!v || 'Choose the customer']" placeholder="Type a name or phone" prepend-inner-icon="mdi-account-search-outline" hide-details="auto">
          <template v-slot:item="{ props: itemProps, item }">
            <v-list-item v-bind="itemProps" :title="item.raw.name" :subtitle="item.raw.phone || ''">
              <template v-slot:append>
                <span class="text-caption font-weight-bold" :class="item.raw.balance > 0 ? 'text-error' : 'text-success'">{{ formatMoney(item.raw.balance) }}</span>
              </template>
            </v-list-item>
          </template>
          <template v-slot:no-data><p class="px-4 py-3 mb-0 text-lightText">{{ debtorSearch ? 'No khata customer by that name' : 'Type a name to search' }}</p></template>
        </v-autocomplete>
        <div v-if="debtor" class="text-caption text-lightText mt-1">
          He owes {{ formatMoney(debtor.balance) }} now · this money is added to his khata.
        </div>
      </v-col>
      <v-col cols="12">
        <v-label class="text-subtitle-1 pb-2 text-lightText">Amount</v-label>
        <v-text-field v-model="form.amount" type="number" min="0" :rules="[rules.positive]" hide-details="auto" autofocus />
      </v-col>
      <v-col cols="12">
        <v-label class="text-subtitle-1 pb-2 text-lightText">{{ isExpense ? 'Spent on' : 'Note' }}</v-label>
        <v-text-field v-model="form.note" :rules="isExpense ? [rules.required] : []" hide-details="auto"
          :placeholder="isExpense ? 'What was it spent on?' : (type === 'In' ? 'Optional' : 'e.g. Tea, rickshaw, paid Rehman Traders')" />
      </v-col>
      <v-col cols="12">
        <div class="d-flex justify-space-between pa-3 rounded-lg bg-grey100">
          <span>Cash in counter now</span><strong>{{ formatMoney(cashNow) }}</strong>
        </div>
        <div class="d-flex justify-space-between pa-3 font-weight-bold" :class="after < 0 ? 'text-error' : 'text-primary'">
          <span>After this</span><span>{{ formatMoney(after) }}</span>
        </div>
      </v-col>
    </v-row>
  </RightDrawer>
</template>
