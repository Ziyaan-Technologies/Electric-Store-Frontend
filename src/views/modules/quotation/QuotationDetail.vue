<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';
import UiParentCard from '@/components/shared/UiParentCard.vue';
import StatusChip from '@/components/shared/StatusChip.vue';
import PrintDialog from '@/components/shared/PrintDialog.vue';
import { useAlerts } from '@/composables/useAlerts';
import { can } from '@/utils/permissions';
import { discountLabel } from '@/utils/bill';
import { formatDate, formatDateTime, formatMoney, formatNumber } from '@/utils/api';

const route = useRoute();
const router = useRouter();
const alerts = useAlerts();
const quotation = ref<any>(null);
const loading = ref(true);
const printOpen = ref(false);

onMounted(async () => {
  try {
    quotation.value = (await axios.get(`quotations/${route.params.id}`)).data;
  } catch (error) {
    alerts.fail(error);
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <v-alert v-model="alerts.showErrorAlert.value" :text="alerts.errorText.value" type="error" density="compact" class="mb-4 single-line-alert" closable />
  <v-skeleton-loader v-if="loading" type="article, table" class="border rounded-lg" />
  <v-row v-else-if="quotation">
    <v-col cols="12" lg="8">
      <UiParentCard :title="`Quotation ${quotation.quotation_number}`" icon="mdi-file-document-edit-outline">
        <template #action>
          <v-btn variant="outlined" color="primary" to="/quotations" prepend-icon="mdi-arrow-left">Back</v-btn>
          <v-btn variant="outlined" color="primary" prepend-icon="mdi-printer" @click="printOpen = true">Print</v-btn>
          <v-btn v-if="quotation.status === 'Open' && can('quotations_convert', 'Quotation') && can('pos_sell', 'POS')" color="primary" variant="flat"
            prepend-icon="mdi-receipt-text-check-outline" @click="router.push({ path: '/pos', query: { quotation: quotation.id } })">Convert to Bill</v-btn>
        </template>
        <div class="border rounded-md overflow-x-auto">
          <v-table density="comfortable">
            <thead>
              <tr><th>ITEM</th><th class="text-right">QTY</th><th class="text-right">PRICE</th><th class="text-right">DISCOUNT</th><th class="text-right">TOTAL</th></tr>
            </thead>
            <tbody>
              <tr v-for="item in quotation.items" :key="item.id">
                <td>
                  <div class="d-flex align-center py-2">
                    <v-avatar size="36" rounded="md" color="grey100">
                      <v-img v-if="item.image_url" :src="item.image_url" contain />
                      <v-icon v-else size="18" color="warning">mdi-account-arrow-left-outline</v-icon>
                    </v-avatar>
                    <div class="ml-3">
                      <div class="text-subtitle-2">{{ item.product_name }}</div>
                      <div class="text-caption text-lightText">{{ item.variant_name }}</div>
                    </div>
                  </div>
                </td>
                <td class="text-right">{{ formatNumber(item.quantity, 3) }}</td>
                <td class="text-right">{{ formatMoney(item.unit_price) }}</td>
                <td class="text-right">{{ item.item_discount + item.bill_discount ? `- ${formatMoney(item.item_discount + item.bill_discount)}` : '-' }}</td>
                <td class="text-right font-weight-bold">{{ formatMoney(item.total) }}</td>
              </tr>
            </tbody>
          </v-table>
        </div>
        <v-alert v-if="!quotation.show_item_prices" type="info" variant="tonal" density="compact" class="mt-3">
          This quotation prints without item prices, showing only the total.
        </v-alert>
      </UiParentCard>
    </v-col>
    <v-col cols="12" lg="4">
      <UiParentCard title="Summary" icon="mdi-information-outline">
        <div class="summary-list">
          <div><span>Status</span><StatusChip :status="quotation.status" /></div>
          <div v-if="quotation.sale"><span>Billed as</span><router-link :to="`/bills/${quotation.sale.id}`" class="text-primary">{{ quotation.sale.bill_number }}</router-link></div>
          <div><span>Date</span><span>{{ formatDateTime(quotation.created_at) }}</span></div>
          <div><span>Valid until</span><span>{{ formatDate(quotation.valid_until) }}</span></div>
          <div><span>Counter</span><span>{{ quotation.counter?.name || '-' }}</span></div>
          <div><span>Prepared by</span><span>{{ quotation.created_by_user?.full_name }}</span></div>
          <div><span>Customer</span><span>{{ quotation.customer_name || 'Walk-in' }} {{ quotation.customer_phone }}</span></div>
          <div class="mt-2"><span>Subtotal</span><span>{{ formatMoney(quotation.subtotal) }}</span></div>
          <div v-if="quotation.item_discount"><span>Item discounts</span><span>- {{ formatMoney(quotation.item_discount) }}</span></div>
          <div v-for="discount in quotation.bill_discounts" :key="discount.code">
            <span>{{ discount.code }} · {{ discountLabel(discount) }} on {{ discount.lines }} items</span><span>- {{ formatMoney(discount.amount) }}</span>
          </div>
          <div class="summary-list__total"><span>Total</span><span>{{ formatMoney(quotation.total_amount) }}</span></div>
          <div v-if="quotation.note"><span>Note</span><span>{{ quotation.note }}</span></div>
        </div>
      </UiParentCard>
    </v-col>
  </v-row>

  <PrintDialog v-model="printOpen" :doc="quotation" kind="quotation" />
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
</style>
