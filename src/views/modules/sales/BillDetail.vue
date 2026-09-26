<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import axios from 'axios';
import UiParentCard from '@/components/shared/UiParentCard.vue';
import StatusChip from '@/components/shared/StatusChip.vue';
import PrintDialog from '@/components/shared/PrintDialog.vue';
import ReturnDialog from './ReturnDialog.vue';
import RightDrawer from '@/components/shared/RightDrawer.vue';
import { useAlerts } from '@/composables/useAlerts';
import { can } from '@/utils/permissions';
import { discountLabel } from '@/utils/bill';
import { formatDateTime, formatMoney, formatNumber } from '@/utils/api';

const route = useRoute();
const alerts = useAlerts();
const sale = ref<any>(null);
const loading = ref(true);
const printOpen = ref(false);
const printDoc = ref<any>(null);
const printKind = ref<'bill' | 'return'>('bill');
const returnOpen = ref(false);
const payOpen = ref(false);
const payRef = ref<any>(null);
const paying = ref(false);
const payForm = ref<any>({ amount: '', method: 'Cash', note: '' });
const payAlerts = useAlerts();
const khataOpen = ref(false);
const khataRef = ref<any>(null);
const khataSaving = ref(false);
const khataForm = ref<any>({ name: '', phone: '', address: '', note: '' });
const khataMatch = ref<any>(null);
const khataAlerts = useAlerts();

function openPay() {
  payForm.value = { amount: sale.value?.payment?.owing || '', method: 'Cash', note: '' };
  payAlerts.clear();
  payOpen.value = true;
  payRef.value?.resetValidation();
}

async function pay() {
  if (!(await payRef.value.validate())) return;
  paying.value = true;
  try {
    sale.value = (await axios.post(`sales/${route.params.id}/payments`, {
      amount: Number(payForm.value.amount) || 0,
      method: payForm.value.method,
      note: payForm.value.note?.trim() || '',
    })).data;
    payOpen.value = false;
    alerts.success(`${formatMoney(payForm.value.amount)} received · ${sale.value.payment.owing > 0 ? `${formatMoney(sale.value.payment.owing)} still owing` : 'bill fully paid'}`);
  } catch (error) {
    payAlerts.fail(error);
  } finally {
    paying.value = false;
  }
}

async function openKhata() {
  khataAlerts.clear();
  khataMatch.value = null;
  try {
    khataMatch.value = (await axios.get(`sales/${route.params.id}/debtor-match`)).data;
    khataForm.value = { name: khataMatch.value.name || '', phone: khataMatch.value.phone || '', address: '', note: '' };
  } catch (error) {
    alerts.fail(error);
    return;
  }
  khataOpen.value = true;
  khataRef.value?.resetValidation();
}

async function saveKhata(useExisting = false) {
  if (!useExisting && !(await khataRef.value.validate())) return;
  khataSaving.value = true;
  try {
    const body = useExisting
      ? { debtor_id: khataMatch.value.existing.id }
      : { name: khataForm.value.name.trim(), phone: khataForm.value.phone?.trim() || '', address: khataForm.value.address?.trim() || '', note: khataForm.value.note?.trim() || '' };
    sale.value = (await axios.post(`sales/${route.params.id}/debtor`, body)).data;
    khataOpen.value = false;
    alerts.success('This bill is now on a khata');
  } catch (error) {
    khataAlerts.fail(error);
  } finally {
    khataSaving.value = false;
  }
}

async function load() {
  try {
    sale.value = (await axios.get(`sales/${route.params.id}`)).data;
  } catch (error) {
    alerts.fail(error);
  } finally {
    loading.value = false;
  }
}

function printBill() {
  printDoc.value = sale.value;
  printKind.value = 'bill';
  printOpen.value = true;
}

function printReturn(row: any) {
  printDoc.value = { ...row, sale: sale.value, vendor: sale.value.vendor, clientstore: sale.value.clientstore };
  printKind.value = 'return';
  printOpen.value = true;
}

function onReturned(result: any) {
  sale.value = result.sale;
  alerts.success(`Return ${result.return.return_number} saved · ${formatMoney(result.return.refund_amount)} refunded by ${result.return.refund_method}`);
  printReturn(result.return);
}

onMounted(load);
</script>

<template>
  <v-alert v-model="alerts.showAlert.value" :text="alerts.alertText.value" type="success" density="compact" class="mb-4 single-line-alert" closable />
  <v-alert v-model="alerts.showErrorAlert.value" :text="alerts.errorText.value" type="error" density="compact" class="mb-4 single-line-alert" closable />
  <v-skeleton-loader v-if="loading" type="article, table" class="border rounded-lg" />
  <v-row v-else-if="sale">
    <v-col cols="12" lg="8">
      <UiParentCard :title="`Bill ${sale.bill_number}`" icon="mdi-receipt-text-outline">
        <template #action>
          <v-btn variant="outlined" color="primary" to="/bills" prepend-icon="mdi-arrow-left">Back</v-btn>
          <v-btn variant="outlined" color="primary" prepend-icon="mdi-printer" @click="printBill">Print</v-btn>
          <v-btn v-if="can('debtors_create', 'Debtors') && sale.payment?.owing > 0 && !sale.debtor_id" variant="outlined" color="warning" prepend-icon="mdi-account-cash-outline" @click="openKhata">Set as Debtor</v-btn>
          <v-btn v-if="can('sales_payment', 'Sales') && sale.payment?.owing > 0" color="success" variant="flat" prepend-icon="mdi-cash-check" @click="openPay">Receive Payment</v-btn>
          <v-btn v-if="can('pos_return', 'POS') && sale.status !== 'Returned'" color="error" variant="flat" prepend-icon="mdi-keyboard-return" @click="returnOpen = true">Return Items</v-btn>
        </template>
        <div class="border rounded-md overflow-x-auto">
          <v-table density="comfortable">
            <thead>
              <tr><th>ITEM</th><th class="text-right">QTY</th><th class="text-right">RETURNED</th><th class="text-right">PRICE</th><th class="text-right">DISCOUNT</th><th class="text-right">TOTAL</th><th class="text-right">BOUGHT PRICE</th></tr>
            </thead>
            <tbody>
              <tr v-for="item in sale.items" :key="item.id">
                <td>
                  <div class="d-flex align-center py-2">
                    <v-avatar size="36" rounded="md" color="grey100">
                      <v-img v-if="item.image_url" :src="item.image_url" contain />
                      <v-icon v-else size="18" color="warning">mdi-account-arrow-left-outline</v-icon>
                    </v-avatar>
                    <div class="ml-3">
                      <div class="text-subtitle-2">{{ item.product_name }}</div>
                      <div class="text-caption text-lightText">{{ item.variant_name || (item.is_outside ? 'From another shopkeeper' : '') }}</div>
                      <v-chip v-if="item.bill_discount_code" size="x-small" color="primary" variant="tonal">{{ item.bill_discount_code }}</v-chip>
                    </div>
                  </div>
                </td>
                <td class="text-right">{{ formatNumber(item.quantity, 3) }}</td>
                <td class="text-right" :class="item.returned_quantity ? 'text-error font-weight-bold' : ''">{{ item.returned_quantity ? formatNumber(item.returned_quantity, 3) : '-' }}</td>
                <td class="text-right">
                  {{ formatMoney(item.unit_price) }}
                  <div v-if="item.unit_price !== item.original_price" class="text-caption text-orange">list {{ formatMoney(item.original_price) }}</div>
                </td>
                <td class="text-right">{{ item.item_discount + item.bill_discount ? `- ${formatMoney(item.item_discount + item.bill_discount)}` : '-' }}</td>
                <td class="text-right font-weight-bold">{{ formatMoney(item.total) }}</td>
                <td class="text-right">
                  <span v-if="item.cost_price === null && item.returned_quantity >= item.quantity" class="text-lightText">Returned</span>
                  <span v-else-if="item.cost_price === null" class="text-error font-weight-bold">Pending</span>
                  <span v-else>{{ formatMoney(item.cost_price) }}</span>
                </td>
              </tr>
            </tbody>
          </v-table>
        </div>
      </UiParentCard>

      <UiParentCard v-if="sale.returns?.length" title="Returns" icon="mdi-keyboard-return" class="mt-5">
        <div v-for="row in sale.returns" :key="row.id" class="return-card">
          <div class="d-flex align-center flex-wrap ga-2">
            <span class="font-weight-bold">{{ row.return_number }}</span>
            <span class="text-caption text-lightText">{{ formatDateTime(row.created_at) }} · {{ row.processed_by_user?.full_name }} · {{ row.counter?.name }}</span>
            <v-spacer />
            <span class="font-weight-bold text-error">- {{ formatMoney(row.refund_amount) }} by {{ row.refund_method }}</span>
            <v-btn icon="mdi-printer" color="#EFF0F1" size="small" title="Print return slip" @click="printReturn(row)" />
          </div>
          <div class="text-caption mt-1">Reason: {{ row.reason }}</div>
          <div v-for="(item, index) in row.items" :key="index" class="d-flex justify-space-between text-body-2 py-1 border-b">
            <span>{{ item.product_name }} {{ item.variant_name }} × {{ formatNumber(item.quantity, 3) }}</span>
            <span>{{ formatMoney(item.refund_amount) }}</span>
          </div>
        </div>
      </UiParentCard>
    </v-col>
    <v-col cols="12" lg="4">
      <UiParentCard title="Summary" icon="mdi-information-outline">
        <div class="summary-list">
          <div><span>Status</span><StatusChip :status="sale.status" /></div>
          <div><span>Date</span><span>{{ formatDateTime(sale.created_at) }}</span></div>
          <div><span>Counter</span><span>{{ sale.counter?.name }}</span></div>
          <div><span>Cashier</span><span>{{ sale.cashier?.full_name }}</span></div>
          <div><span>Customer</span><span>{{ sale.customer_name || 'Walk-in' }} {{ sale.customer_phone }}</span></div>
          <div class="mt-2"><span>Subtotal</span><span>{{ formatMoney(sale.subtotal) }}</span></div>
          <div v-if="sale.item_discount"><span>Item discounts</span><span>- {{ formatMoney(sale.item_discount) }}</span></div>
          <div v-for="discount in sale.bill_discounts" :key="discount.code">
            <span>{{ discount.code }} · {{ discountLabel(discount) }} on {{ discount.lines }} items</span><span>- {{ formatMoney(discount.amount) }}</span>
          </div>
          <div class="summary-list__total"><span>Total</span><span>{{ formatMoney(sale.total_amount) }}</span></div>
          <div><span>Paid by</span><span>{{ sale.payment_method }}</span></div>
          <div v-if="sale.payment_method === 'Cash'"><span>Cash received / change</span><span>{{ formatMoney(sale.amount_received) }} / {{ formatMoney(sale.change_amount) }}</span></div>
          <template v-if="sale.refunded_amount">
            <div class="text-error"><span>Refunded</span><span>- {{ formatMoney(sale.refunded_amount) }}</span></div>
            <div class="font-weight-bold"><span>Net after returns</span><span>{{ formatMoney(sale.total_amount - sale.refunded_amount) }}</span></div>
          </template>
          <div class="mt-2" :class="sale.pending_costs ? 'text-orange' : 'text-successdark'">
            <span>Profit{{ sale.pending_costs ? ' (provisional)' : '' }}</span><span class="font-weight-bold">{{ formatMoney(sale.profit) }}</span>
          </div>
        </div>
      </UiParentCard>
    </v-col>
  </v-row>

  <PrintDialog v-model="printOpen" :doc="printDoc" :kind="printKind" />
  <RightDrawer ref="payRef" v-model="payOpen" title="Receive Payment" icon="mdi-cash-check"
    :subtitle="sale ? `${sale.bill_number} · ${formatMoney(sale.payment?.owing || 0)} still owing` : ''" submit-label="Save Payment" :loading="paying"
    :show-error-alert="payAlerts.showErrorAlert.value" :error-text="payAlerts.errorText.value"
    @submit="pay" @close-error="payAlerts.clear()">
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
      </v-col>
      <v-col cols="12">
        <v-label class="text-subtitle-1 pb-2 text-lightText">Note</v-label>
        <v-text-field v-model="payForm.note" placeholder="Optional" hide-details />
      </v-col>
    </v-row>
  </RightDrawer>

  <RightDrawer ref="khataRef" v-model="khataOpen" title="Set as Debtor" icon="mdi-account-cash-outline"
    :subtitle="sale ? `${sale.bill_number} · ${formatMoney(sale.payment?.owing || 0)} goes on the khata` : ''"
    submit-label="Create Debtor & Attach" :loading="khataSaving"
    :show-error-alert="khataAlerts.showErrorAlert.value" :error-text="khataAlerts.errorText.value"
    @submit="saveKhata(false)" @close-error="khataAlerts.clear()">
    <v-alert v-if="khataMatch?.existing" type="info" variant="tonal" density="compact" class="mt-3">
      <div class="d-flex flex-wrap align-center ga-2">
        <span>{{ khataMatch.existing.name }} already has this phone.</span>
        <v-btn size="small" color="primary" variant="flat" :loading="khataSaving" @click="saveKhata(true)">Attach to him</v-btn>
      </div>
    </v-alert>
    <v-row>
      <v-col cols="12" class="pt-4">
        <v-label class="text-subtitle-1 pb-2 text-lightText">Name</v-label>
        <v-text-field v-model="khataForm.name" :rules="[(v: string) => !!v?.trim() || 'Name is required']" hide-details="auto" />
      </v-col>
      <v-col cols="12" sm="6">
        <v-label class="text-subtitle-1 pb-2 text-lightText">Phone</v-label>
        <v-text-field v-model="khataForm.phone" hide-details="auto" />
      </v-col>
      <v-col cols="12" sm="6">
        <v-label class="text-subtitle-1 pb-2 text-lightText">Address</v-label>
        <v-text-field v-model="khataForm.address" hide-details="auto" />
      </v-col>
      <v-col cols="12">
        <v-label class="text-subtitle-1 pb-2 text-lightText">Note</v-label>
        <v-text-field v-model="khataForm.note" placeholder="Optional" hide-details />
      </v-col>
    </v-row>
  </RightDrawer>

  <ReturnDialog v-model="returnOpen" :sale-id="sale?.id || null" @returned="onReturned" />
</template>

<style scoped>
.summary-list > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 5px 0;
  font-size: 13.5px;
}

.summary-list__total {
  margin: 6px 0;
  padding: 8px 0 !important;
  border-top: 1px dashed rgb(var(--v-theme-borderColor));
  border-bottom: 1px dashed rgb(var(--v-theme-borderColor));
  font-size: 18px !important;
  font-weight: 700;
  color: rgb(var(--v-theme-primary));
}

.return-card {
  padding: 12px 14px;
  margin-bottom: 10px;
  border: 1px solid rgba(var(--v-theme-error), 0.25);
  border-radius: 10px;
  background: rgb(var(--v-theme-lightred));
}
</style>
