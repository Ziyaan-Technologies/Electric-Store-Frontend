<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';
import UiParentCard from '@/components/shared/UiParentCard.vue';
import StatusChip from '@/components/shared/StatusChip.vue';
import RightDrawer from '@/components/shared/RightDrawer.vue';
import { useAlerts } from '@/composables/useAlerts';
import { can } from '@/utils/permissions';
import { formatDateTime, formatMoney } from '@/utils/api';

const route = useRoute();
const router = useRouter();
const alerts = useAlerts();
const drawerAlerts = useAlerts();
const debtor = ref<any>(null);
const loading = ref(true);

const payOpen = ref(false);
const payRef = ref<any>(null);
const paying = ref(false);
const payForm = ref<any>({ amount: '', method: 'Cash', note: '' });

const owed = computed(() => Number(debtor.value?.balance || 0));

async function load() {
  try {
    debtor.value = (await axios.get(`debtors/${route.params.id}`)).data;
  } catch (error) {
    alerts.fail(error);
  } finally {
    loading.value = false;
  }
}

function openPay() {
  payForm.value = { amount: owed.value || '', method: 'Cash', note: '' };
  drawerAlerts.clear();
  payOpen.value = true;
  payRef.value?.resetValidation();
}

async function pay() {
  if (!(await payRef.value.validate())) return;
  paying.value = true;
  try {
    debtor.value = (await axios.post(`debtors/${route.params.id}/payments`, {
      amount: Number(payForm.value.amount) || 0,
      method: payForm.value.method,
      note: payForm.value.note?.trim() || '',
    })).data;
    payOpen.value = false;
    alerts.success(`${formatMoney(payForm.value.amount)} received · balance is now ${formatMoney(debtor.value.balance)}`);
  } catch (error) {
    drawerAlerts.fail(error);
  } finally {
    paying.value = false;
  }
}

onMounted(load);
</script>

<template>
  <v-alert v-model="alerts.showAlert.value" :text="alerts.alertText.value" type="success" density="compact" class="mb-4 single-line-alert" closable />
  <v-alert v-model="alerts.showErrorAlert.value" :text="alerts.errorText.value" type="error" density="compact" class="mb-4 single-line-alert" closable />
  <v-skeleton-loader v-if="loading" type="article, table" class="border rounded-lg" />

  <v-row v-else-if="debtor">
    <v-col cols="12">
      <UiParentCard>
        <div class="d-flex flex-wrap align-center ga-4">
          <v-avatar size="52" :color="debtor.image_url ? undefined : 'primary'" :variant="debtor.image_url ? undefined : 'tonal'" class="border bg-white">
            <v-img v-if="debtor.image_url" :src="debtor.image_url" cover />
            <v-icon v-else size="26">mdi-account-cash-outline</v-icon>
          </v-avatar>
          <div class="flex-grow-1">
            <h4 class="text-h5 mb-1">{{ debtor.name }}</h4>
            <div class="text-body-2 text-lightText">
              <span v-if="debtor.phone">{{ debtor.phone }}</span>
              <span v-if="debtor.phone && debtor.address"> · </span>
              <span v-if="debtor.address">{{ debtor.address }}</span>
            </div>
          </div>
          <div class="text-end">
            <div class="text-caption text-lightText">Balance</div>
            <div class="text-h4 font-weight-bold" :class="owed > 0 ? 'text-error' : 'text-success'">{{ formatMoney(debtor.balance) }}</div>
          </div>
          <div class="d-flex ga-2">
            <v-btn variant="outlined" color="primary" prepend-icon="mdi-arrow-left" @click="router.push('/debtors')">Back</v-btn>
            <v-btn v-if="can('debtors_payment', 'Debtors')" color="primary" variant="flat" prepend-icon="mdi-cash-check" :disabled="owed <= 0" @click="openPay">Receive Payment</v-btn>
          </div>
        </div>

        <div class="khata-summary mt-5">
          <div class="khata-summary__box">
            <span>Opening balance</span><strong>{{ formatMoney(debtor.opening_balance) }}</strong>
          </div>
          <div class="khata-summary__box">
            <span>Put on khata</span><strong>{{ formatMoney(debtor.billed) }}</strong>
          </div>
          <div class="khata-summary__box">
            <span>Paid</span><strong class="text-success">{{ formatMoney(debtor.paid) }}</strong>
          </div>
          <div class="khata-summary__box">
            <span>Bills</span><strong>{{ debtor.bill_count }}</strong>
          </div>
        </div>
        <p v-if="debtor.note" class="text-body-2 text-lightText mt-4 mb-0">{{ debtor.note }}</p>
      </UiParentCard>
    </v-col>

    <v-col cols="12" lg="7">
      <UiParentCard title="Bills on this khata" icon="mdi-receipt-text-outline">
        <v-table class="border rounded-md">
          <thead>
            <tr>
              <th class="text-left">BILL</th>
              <th class="text-left">DATE</th>
              <th class="text-left">SHOP</th>
              <th class="text-right">TOTAL</th>
              <th class="text-right">PAID</th>
              <th class="text-right">ON KHATA</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="bill in debtor.bills" :key="bill.id">
              <td>
                <div class="font-weight-semibold">{{ bill.bill_number }}</div>
                <StatusChip v-if="bill.status !== 'Completed'" :status="bill.status" />
              </td>
              <td class="text-no-wrap">{{ formatDateTime(bill.created_at) }}</td>
              <td>
                <div>{{ bill.shop }}</div>
                <div class="text-caption text-lightText">{{ bill.counter }} · {{ bill.cashier?.full_name }}</div>
              </td>
              <td class="text-right">{{ formatMoney(bill.total_amount) }}</td>
              <td class="text-right">{{ formatMoney(bill.paid_amount) }}</td>
              <td class="text-right font-weight-bold" :class="bill.khata_amount > 0 ? 'text-error' : 'text-success'">{{ formatMoney(bill.khata_amount) }}</td>
              <td class="text-right">
                <v-btn icon="mdi-eye-outline" color="#EFF0F1" size="small" title="Open bill" @click="router.push(`/bills/${bill.id}`)"></v-btn>
              </td>
            </tr>
            <tr v-if="!debtor.bills.length"><td colspan="7" class="text-center text-lightText py-6">No bills on this khata yet</td></tr>
          </tbody>
        </v-table>
      </UiParentCard>
    </v-col>

    <v-col cols="12" lg="5">
      <UiParentCard title="Payments" icon="mdi-cash-check">
        <v-table class="border rounded-md">
          <thead>
            <tr>
              <th class="text-left">DATE</th>
              <th class="text-left">TAKEN AT</th>
              <th class="text-left">BY</th>
              <th class="text-right">AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="payment in debtor.payments" :key="payment.id">
              <td class="text-no-wrap">{{ formatDateTime(payment.created_at) }}</td>
              <td>
                <div>{{ payment.counter || 'Taken directly' }}</div>
                <div class="text-caption text-lightText">{{ [payment.shop, payment.method].filter(Boolean).join(' · ') }}</div>
              </td>
              <td>
                <div>{{ payment.received_by?.full_name }}</div>
                <div v-if="payment.note" class="text-caption text-lightText">{{ payment.note }}</div>
              </td>
              <td class="text-right font-weight-bold text-success">{{ formatMoney(payment.amount) }}</td>
            </tr>
            <tr v-if="!debtor.payments.length"><td colspan="4" class="text-center text-lightText py-6">No payments yet</td></tr>
          </tbody>
        </v-table>
      </UiParentCard>
    </v-col>
  </v-row>

  <RightDrawer ref="payRef" v-model="payOpen" title="Receive Payment" icon="mdi-cash-check"
    :subtitle="debtor ? `${debtor.name} · owes ${formatMoney(debtor.balance)}` : ''" submit-label="Save Payment" :loading="paying"
    :show-error-alert="drawerAlerts.showErrorAlert.value" :error-text="drawerAlerts.errorText.value"
    @submit="pay" @close-error="drawerAlerts.clear()">
    <v-row>
      <v-col cols="12" class="pt-4">
        <v-label class="text-subtitle-1 pb-2 text-lightText">Amount</v-label>
        <v-text-field v-model="payForm.amount" type="number" min="0" :rules="[(v: any) => Number(v) > 0 || 'Enter the amount being paid']" hide-details="auto" autofocus />
      </v-col>
      <v-col cols="12">
        <v-label class="text-subtitle-1 pb-2 text-lightText">Paid by</v-label>
        <v-btn-toggle v-model="payForm.method" mandatory color="primary" variant="outlined" divided density="comfortable" class="w-100">
          <v-btn value="Cash" class="flex-grow-1 text-none">Cash</v-btn>
          <v-btn value="Card" class="flex-grow-1 text-none">Card</v-btn>
          <v-btn value="Online" class="flex-grow-1 text-none">Online</v-btn>
        </v-btn-toggle>
        <div class="text-caption text-lightText mt-1">Cash goes into your counter when you have one open, otherwise it is recorded as taken by you.</div>
      </v-col>
      <v-col cols="12">
        <v-label class="text-subtitle-1 pb-2 text-lightText">Note</v-label>
        <v-text-field v-model="payForm.note" placeholder="Optional" hide-details />
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
