<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import axios from 'axios';
import RightDrawer from '@/components/shared/RightDrawer.vue';
import { useAlerts } from '@/composables/useAlerts';
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
const drawerRef = ref<any>(null);
const saving = ref(false);
const form = ref({ reason: '', amount: '' as number | string, note: '' });

const reasons = computed(() => (props.type === 'In'
  ? ['Change money added', 'Owner put cash in', 'Other']
  : ['Shop expense', 'Paid another shopkeeper', 'Owner took cash', 'Bank deposit', 'Other']));

const after = computed(() => props.cashNow + (props.type === 'In' ? 1 : -1) * (Number(form.value.amount) || 0));

async function submit() {
  if (!(await drawerRef.value.validate())) return;
  saving.value = true;
  try {
    const session = (await axios.post(`counter-sessions/${props.sessionId}/cash-moves`, { type: props.type, ...form.value, amount: Number(form.value.amount) })).data;
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
    alerts.clear();
    drawerRef.value?.resetValidation();
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
      <v-col cols="12">
        <v-label class="text-subtitle-1 pb-2 text-lightText">Amount</v-label>
        <v-text-field v-model="form.amount" type="number" min="0" :rules="[rules.positive]" hide-details="auto" autofocus />
      </v-col>
      <v-col cols="12">
        <v-label class="text-subtitle-1 pb-2 text-lightText">Note</v-label>
        <v-text-field v-model="form.note" hide-details :placeholder="type === 'In' ? 'Optional' : 'e.g. Tea, rickshaw, paid Rehman Traders'" />
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
