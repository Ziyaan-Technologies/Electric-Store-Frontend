<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';
import UiParentCard from '@/components/shared/UiParentCard.vue';
import RightDrawer from '@/components/shared/RightDrawer.vue';
import { useAlerts } from '@/composables/useAlerts';
import { useAuthStore } from '@/stores/auth';
import { can } from '@/utils/permissions';
import { formatDateTime, formatMoney } from '@/utils/api';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const alerts = useAlerts();
const drawerAlerts = useAlerts();
const entryAlerts = useAlerts();
const creditor = ref<any>(null);
const loading = ref(true);

const payOpen = ref(false);
const payRef = ref<any>(null);
const paying = ref(false);
const payForm = ref<any>({ amount: '', method: 'Cash', note: '' });

const entryOpen = ref(false);
const entryRef = ref<any>(null);
const addingEntry = ref(false);
const entryForm = ref<any>({ amount: '', note: '' });

const owed = computed(() => Number(creditor.value?.balance || 0));
const extra = computed(() => Math.max(Number(payForm.value.amount || 0) - Math.max(owed.value, 0), 0));

async function load() {
  try {
    creditor.value = (await axios.get(`creditors/${route.params.id}`)).data;
  } catch (error) {
    alerts.fail(error);
  } finally {
    loading.value = false;
  }
}

function openPay() {
  payForm.value = { amount: owed.value > 0 ? owed.value : '', method: 'Cash', note: '' };
  drawerAlerts.clear();
  payOpen.value = true;
  payRef.value?.resetValidation();
}

async function pay() {
  if (!(await payRef.value.validate())) return;
  paying.value = true;
  try {
    creditor.value = (await axios.post(`creditors/${route.params.id}/payments`, {
      amount: Number(payForm.value.amount) || 0,
      method: payForm.value.method,
      clientstore_id: authStore.clientstoreId || undefined,
      note: payForm.value.note?.trim() || '',
    })).data;
    payOpen.value = false;
    alerts.success(`${formatMoney(payForm.value.amount)} paid · ${creditor.value.balance > 0 ? `still owing ${formatMoney(creditor.value.balance)}` : creditor.value.advance > 0 ? `advance with him is now ${formatMoney(creditor.value.advance)}` : 'his khata is clear'}`);
  } catch (error) {
    drawerAlerts.fail(error);
  } finally {
    paying.value = false;
  }
}

function openEntry() {
  entryForm.value = { amount: '', note: '' };
  entryAlerts.clear();
  entryOpen.value = true;
  entryRef.value?.resetValidation();
}

async function addEntry() {
  if (!(await entryRef.value.validate())) return;
  addingEntry.value = true;
  try {
    creditor.value = (await axios.post(`creditors/${route.params.id}/entries`, {
      amount: Number(entryForm.value.amount) || 0,
      clientstore_id: authStore.clientstoreId || undefined,
      note: entryForm.value.note.trim(),
    })).data;
    entryOpen.value = false;
    alerts.success(`${formatMoney(entryForm.value.amount)} added · we owe him ${formatMoney(creditor.value.owed)}`);
  } catch (error) {
    entryAlerts.fail(error);
  } finally {
    addingEntry.value = false;
  }
}

onMounted(load);
</script>

<template>
  <v-alert v-model="alerts.showAlert.value" :text="alerts.alertText.value" type="success" density="compact" class="mb-4 single-line-alert" closable />
  <v-alert v-model="alerts.showErrorAlert.value" :text="alerts.errorText.value" type="error" density="compact" class="mb-4 single-line-alert" closable />
  <v-skeleton-loader v-if="loading" type="article, table" class="border rounded-lg" />

  <v-row v-else-if="creditor">
    <v-col cols="12">
      <UiParentCard>
        <div class="d-flex flex-wrap align-center ga-4">
          <v-avatar size="52" :color="creditor.image_url ? undefined : 'primary'" :variant="creditor.image_url ? undefined : 'tonal'" class="border bg-white">
            <v-img v-if="creditor.image_url" :src="creditor.image_url" cover />
            <v-icon v-else size="26">mdi-account-arrow-left-outline</v-icon>
          </v-avatar>
          <div class="flex-grow-1">
            <h4 class="text-h5 mb-1">{{ creditor.name }}</h4>
            <div class="text-body-2 text-lightText">
              <span v-if="creditor.phone">{{ creditor.phone }}</span>
              <span v-if="creditor.phone && creditor.address"> · </span>
              <span v-if="creditor.address">{{ creditor.address }}</span>
            </div>
          </div>
          <div class="text-end">
            <div class="text-caption text-lightText">{{ owed < 0 ? 'Advance with him' : 'We owe' }}</div>
            <div class="text-h4 font-weight-bold" :class="owed > 0 ? 'text-error' : 'text-success'">{{ formatMoney(owed < 0 ? creditor.advance : owed) }}</div>
          </div>
          <div class="d-flex ga-2">
            <v-btn variant="outlined" color="primary" prepend-icon="mdi-arrow-left" @click="router.push('/creditors')">Back</v-btn>
            <v-btn v-if="can('creditors_edit', 'Creditors')" variant="outlined" color="primary" prepend-icon="mdi-plus" @click="openEntry">Add What We Owe</v-btn>
            <v-btn v-if="can('creditors_payment', 'Creditors')" color="primary" variant="flat" prepend-icon="mdi-cash-fast" @click="openPay">Pay Him</v-btn>
          </div>
        </div>

        <div class="khata-summary mt-5">
          <div class="khata-summary__box">
            <span>Opening balance</span><strong>{{ formatMoney(creditor.opening_balance) }}</strong>
          </div>
          <div class="khata-summary__box">
            <span>Taken from him</span><strong>{{ formatMoney(creditor.taken) }}</strong>
          </div>
          <div class="khata-summary__box">
            <span>Paid</span><strong class="text-success">{{ formatMoney(creditor.paid) }}</strong>
          </div>
          <div class="khata-summary__box">
            <span>Khata entries</span><strong>{{ creditor.entries }}</strong>
          </div>
        </div>
        <p v-if="creditor.note" class="text-body-2 text-lightText mt-4 mb-0">{{ creditor.note }}</p>
      </UiParentCard>
    </v-col>

    <v-col cols="12" lg="7">
      <UiParentCard title="What we took from him" icon="mdi-package-variant-closed">
        <v-table class="border rounded-md">
          <thead>
            <tr>
              <th class="text-left">DATE</th>
              <th class="text-left">WHAT IT WAS</th>
              <th class="text-left">SHOP</th>
              <th class="text-right">AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in creditor.entry_rows" :key="row.id">
              <td class="text-no-wrap">{{ formatDateTime(row.created_at) }}</td>
              <td>
                <div>{{ row.note }}</div>
                <div class="text-caption text-lightText">{{ row.type === 'Item' ? 'From a bill' : 'Entered by hand' }}<span v-if="row.added_by"> · {{ row.added_by.full_name }}</span></div>
              </td>
              <td>{{ row.shop || '-' }}</td>
              <td class="text-right font-weight-bold text-error">{{ formatMoney(row.amount) }}</td>
            </tr>
            <tr v-if="!creditor.entry_rows.length"><td colspan="4" class="text-center text-lightText py-6">Nothing taken from him yet</td></tr>
          </tbody>
        </v-table>
      </UiParentCard>
    </v-col>

    <v-col cols="12" lg="5">
      <UiParentCard title="Payments" icon="mdi-cash-fast">
        <v-table class="border rounded-md">
          <thead>
            <tr>
              <th class="text-left">DATE</th>
              <th class="text-left">PAID FROM</th>
              <th class="text-left">BY</th>
              <th class="text-right">AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="payment in creditor.payments" :key="payment.id">
              <td class="text-no-wrap">{{ formatDateTime(payment.created_at) }}</td>
              <td>
                <div>{{ payment.counter || 'Paid directly' }}</div>
                <div class="text-caption text-lightText">{{ [payment.shop, payment.method].filter(Boolean).join(' · ') }}</div>
              </td>
              <td>
                <div>{{ payment.paid_by?.full_name }}</div>
                <div v-if="payment.note" class="text-caption text-lightText">{{ payment.note }}</div>
              </td>
              <td class="text-right font-weight-bold text-success">{{ formatMoney(payment.amount) }}</td>
            </tr>
            <tr v-if="!creditor.payments.length"><td colspan="4" class="text-center text-lightText py-6">No payments yet</td></tr>
          </tbody>
        </v-table>
      </UiParentCard>
    </v-col>
  </v-row>

  <RightDrawer ref="payRef" v-model="payOpen" title="Pay Him" icon="mdi-cash-fast"
    :subtitle="creditor ? `${creditor.name} · ${creditor.balance > 0 ? `we owe ${formatMoney(creditor.balance)}` : `advance ${formatMoney(creditor.advance)}`}` : ''"
    submit-label="Save Payment" :loading="paying"
    :show-error-alert="drawerAlerts.showErrorAlert.value" :error-text="drawerAlerts.errorText.value"
    @submit="pay" @close-error="drawerAlerts.clear()">
    <v-row>
      <v-col cols="12" class="pt-4">
        <v-label class="text-subtitle-1 pb-2 text-lightText">Amount</v-label>
        <v-text-field v-model="payForm.amount" type="number" min="0" :rules="[(v: any) => Number(v) > 0 || 'Enter the amount being paid']" hide-details="auto" autofocus />
        <div v-if="extra > 0" class="text-caption text-lightText mt-1">{{ formatMoney(extra) }} more than we owe — kept as an advance with him.</div>
      </v-col>
      <v-col cols="12">
        <v-label class="text-subtitle-1 pb-2 text-lightText">Paid by</v-label>
        <v-btn-toggle v-model="payForm.method" mandatory color="primary" variant="outlined" divided density="comfortable" class="w-100">
          <v-btn value="Cash" class="flex-grow-1 text-none">Cash</v-btn>
          <v-btn value="Card" class="flex-grow-1 text-none">Card</v-btn>
          <v-btn value="Online" class="flex-grow-1 text-none">Online</v-btn>
        </v-btn-toggle>
        <div class="text-caption text-lightText mt-1">{{ payForm.method === 'Cash' ? 'Cash comes out of your counter when you have one open, otherwise it is recorded as paid by you.' : 'Does not touch the counter cash.' }}</div>
      </v-col>
      <v-col cols="12">
        <v-label class="text-subtitle-1 pb-2 text-lightText">Note</v-label>
        <v-text-field v-model="payForm.note" placeholder="Optional" hide-details />
      </v-col>
    </v-row>
  </RightDrawer>

  <RightDrawer ref="entryRef" v-model="entryOpen" title="Add What We Owe" icon="mdi-package-variant-closed"
    :subtitle="creditor ? creditor.name : ''" submit-label="Add to Khata" :loading="addingEntry"
    :show-error-alert="entryAlerts.showErrorAlert.value" :error-text="entryAlerts.errorText.value"
    @submit="addEntry" @close-error="entryAlerts.clear()">
    <v-row>
      <v-col cols="12" class="pt-4">
        <v-label class="text-subtitle-1 pb-2 text-lightText">Amount</v-label>
        <v-text-field v-model="entryForm.amount" type="number" min="0" :rules="[(v: any) => Number(v) > 0 || 'Enter the amount']" hide-details="auto" autofocus />
      </v-col>
      <v-col cols="12">
        <v-label class="text-subtitle-1 pb-2 text-lightText">What it was</v-label>
        <v-text-field v-model="entryForm.note" :rules="[(v: string) => !!v?.trim() || 'Write what we took from him']" placeholder="e.g. 10 pcs 4mm wire" hide-details="auto" />
      </v-col>
    </v-row>
  </RightDrawer>
</template>

<style scoped>
.khata-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.khata-summary__box {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border: 1px solid rgb(var(--v-theme-borderColor));
  border-radius: 12px;
}

.khata-summary__box span {
  font-size: 12px;
  color: rgb(var(--v-theme-lightText));
}

.khata-summary__box strong {
  font-size: 16px;
}

@media (max-width: 767px) {
  .khata-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
