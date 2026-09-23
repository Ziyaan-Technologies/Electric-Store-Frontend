<script setup lang="ts">
import { computed } from 'vue';
import { discountLabel } from '@/utils/bill';
import { formatDate, formatDateTime, formatNumber } from '@/utils/api';
import type { Paper } from '@/utils/print';

const props = defineProps<{
  doc: any;
  kind: 'bill' | 'quotation' | 'return';
  paper: Paper;
}>();

const isQuotation = computed(() => props.kind === 'quotation');
const showPrices = computed(() => !isQuotation.value || props.doc.show_item_prices !== false);
const currency = computed(() => props.doc?.vendor?.country?.currency_symbol || 'Rs');
const number = computed(() => (isQuotation.value ? props.doc.quotation_number : props.doc.bill_number));
const person = computed(() => (isQuotation.value ? props.doc.created_by_user?.full_name : props.doc.cashier?.full_name));
const party = computed(() => [props.doc.customer_name, props.doc.customer_phone].filter(Boolean).join(' · ') || 'Walk-in customer');

function amount(value?: number | string | null) {
  return Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
</script>

<template>
  <div v-if="kind === 'return' && paper === '80mm'" class="print-sheet print-receipt">
    <div class="text-center">
      <div class="print-receipt__title">{{ doc.vendor?.business_name }}</div>
      <div>{{ doc.clientstore?.store_name }}</div>
      <div v-if="doc.clientstore?.store_phone">Tel: {{ doc.clientstore.store_phone }}</div>
    </div>
    <div class="print-receipt__line" />
    <div class="print-receipt__heading">RETURN SLIP</div>
    <div class="print-receipt__row"><span>Return No</span><span>{{ doc.return_number }}</span></div>
    <div class="print-receipt__row"><span>Bill No</span><span>{{ doc.sale?.bill_number }}</span></div>
    <div class="print-receipt__row"><span>Date</span><span>{{ formatDateTime(doc.created_at) }}</span></div>
    <div class="print-receipt__row"><span>Counter</span><span>{{ doc.counter?.name }}</span></div>
    <div class="print-receipt__row"><span>By</span><span>{{ doc.processed_by_user?.full_name }}</span></div>
    <div class="print-receipt__row"><span>Customer</span><span>{{ [doc.sale?.customer_name, doc.sale?.customer_phone].filter(Boolean).join(' · ') || 'Walk-in customer' }}</span></div>
    <div class="print-receipt__line" />
    <table class="print-receipt__items">
      <thead><tr><th class="text-left">Item</th><th>Qty</th><th>Refund</th></tr></thead>
      <tbody>
        <template v-for="(item, index) in doc.items" :key="index">
          <tr><td colspan="3" class="font-weight-bold text-left">{{ item.product_name }} {{ item.variant_name }}</td></tr>
          <tr><td></td><td>{{ formatNumber(item.quantity, 3) }}</td><td>{{ amount(item.refund_amount) }}</td></tr>
        </template>
      </tbody>
    </table>
    <div class="print-receipt__line" />
    <div class="print-receipt__row print-receipt__total"><span>REFUND</span><span>{{ currency }} {{ amount(doc.refund_amount) }}</span></div>
    <div class="print-receipt__row"><span>Refunded by</span><span>{{ doc.refund_method }}</span></div>
    <div class="print-receipt__line" />
    <div class="text-center">Reason: {{ doc.reason }}</div>
  </div>

  <div v-else-if="kind === 'return'" class="print-sheet print-a4">
    <div class="print-a4__head">
      <div>
        <div class="print-a4__business">{{ doc.vendor?.business_name }}</div>
        <div class="print-a4__muted">{{ doc.clientstore?.store_name }}</div>
        <div v-if="doc.clientstore?.address" class="print-a4__muted">{{ doc.clientstore.address }}</div>
        <div v-if="doc.clientstore?.store_phone" class="print-a4__muted">Tel: {{ doc.clientstore.store_phone }}</div>
      </div>
      <div class="text-right">
        <div class="print-a4__title print-a4__title--return">RETURN SLIP</div>
        <div class="print-a4__number">{{ doc.return_number }}</div>
      </div>
    </div>
    <div class="print-a4__meta">
      <div class="print-a4__box">
        <div class="print-a4__label">Customer</div>
        <div class="font-weight-bold">{{ doc.sale?.customer_name || 'Walk-in customer' }}</div>
        <div v-if="doc.sale?.customer_phone">{{ doc.sale.customer_phone }}</div>
      </div>
      <div class="print-a4__box">
        <div class="print-a4__pair"><span>Date</span><span>{{ formatDateTime(doc.created_at) }}</span></div>
        <div class="print-a4__pair"><span>Original bill</span><span>{{ doc.sale?.bill_number }} · {{ formatDate(doc.sale?.created_at) }}</span></div>
        <div class="print-a4__pair"><span>Counter</span><span>{{ doc.counter?.name }}</span></div>
        <div class="print-a4__pair"><span>Processed by</span><span>{{ doc.processed_by_user?.full_name }}</span></div>
      </div>
    </div>
    <table class="print-a4__table">
      <thead>
        <tr><th style="width: 40px">#</th><th class="text-left">Item</th><th style="width: 90px">Qty</th><th style="width: 140px">Refund</th></tr>
      </thead>
      <tbody>
        <tr v-for="(item, index) in doc.items" :key="index">
          <td>{{ index + 1 }}</td>
          <td class="text-left">
            <div class="font-weight-bold">{{ item.product_name }}</div>
            <div class="print-a4__muted">{{ item.variant_name }}</div>
          </td>
          <td>{{ formatNumber(item.quantity, 3) }}</td>
          <td class="font-weight-bold">{{ amount(item.refund_amount) }}</td>
        </tr>
      </tbody>
    </table>
    <div class="print-a4__bottom">
      <div class="print-a4__notes">
        <span class="print-a4__label">Reason</span>
        <div>{{ doc.reason }}</div>
      </div>
      <div class="print-a4__totals">
        <div class="print-a4__pair print-a4__grand print-a4__grand--return"><span>Refund</span><span>{{ currency }} {{ amount(doc.refund_amount) }}</span></div>
        <div class="print-a4__pair"><span>Refunded by</span><span>{{ doc.refund_method }}</span></div>
      </div>
    </div>
  </div>

  <div v-else-if="paper === '80mm'" class="print-sheet print-receipt">
    <div class="text-center">
      <div class="print-receipt__title">{{ doc.vendor?.business_name }}</div>
      <div>{{ doc.clientstore?.store_name }}</div>
      <div v-if="doc.clientstore?.address">{{ doc.clientstore.address }}</div>
      <div v-if="doc.clientstore?.store_phone">Tel: {{ doc.clientstore.store_phone }}</div>
    </div>
    <div class="print-receipt__line" />
    <div class="print-receipt__heading">{{ isQuotation ? 'QUOTATION' : 'SALES BILL' }}</div>
    <div class="print-receipt__row"><span>{{ isQuotation ? 'Quotation No' : 'Bill No' }}</span><span>{{ number }}</span></div>
    <div class="print-receipt__row"><span>Date</span><span>{{ formatDateTime(doc.created_at) }}</span></div>
    <div v-if="isQuotation" class="print-receipt__row"><span>Valid Until</span><span>{{ formatDate(doc.valid_until) }}</span></div>
    <div v-if="!isQuotation && doc.counter" class="print-receipt__row"><span>Counter</span><span>{{ doc.counter.name }}</span></div>
    <div class="print-receipt__row"><span>{{ isQuotation ? 'Prepared By' : 'Cashier' }}</span><span>{{ person }}</span></div>
    <div class="print-receipt__row"><span>Customer</span><span>{{ party }}</span></div>
    <div class="print-receipt__line" />
    <table class="print-receipt__items">
      <thead>
        <tr v-if="showPrices"><th class="text-left">Item</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>
        <tr v-else><th class="text-left">Item</th><th>Qty</th></tr>
      </thead>
      <tbody>
        <template v-for="item in doc.items" :key="item.id">
          <tr><td :colspan="showPrices ? 4 : 1" class="font-weight-bold text-left">{{ item.product_name }} {{ item.variant_name }}</td><td v-if="!showPrices">{{ formatNumber(item.quantity, 3) }}</td></tr>
          <tr v-if="showPrices">
            <td></td>
            <td>{{ formatNumber(item.quantity, 3) }}</td>
            <td>{{ amount(item.unit_price) }}</td>
            <td>{{ amount(item.gross) }}</td>
          </tr>
          <tr v-if="showPrices && item.item_discount > 0"><td colspan="3" class="text-left">&nbsp;&nbsp;Item discount</td><td>-{{ amount(item.item_discount) }}</td></tr>
          <tr v-if="item.returned_quantity > 0"><td colspan="3" class="text-left">&nbsp;&nbsp;Returned</td><td>{{ formatNumber(item.returned_quantity, 3) }}</td></tr>
        </template>
      </tbody>
    </table>
    <div class="print-receipt__line" />
    <template v-if="showPrices">
      <div class="print-receipt__row"><span>Subtotal</span><span>{{ amount(doc.subtotal) }}</span></div>
      <div v-if="doc.item_discount > 0" class="print-receipt__row"><span>Item discounts</span><span>-{{ amount(doc.item_discount) }}</span></div>
      <div v-for="discount in doc.bill_discounts" :key="discount.code" class="print-receipt__row">
        <span>Discount {{ discountLabel(discount) }} ({{ discount.lines }} items)</span><span>-{{ amount(discount.amount) }}</span>
      </div>
    </template>
    <div class="print-receipt__row print-receipt__total"><span>{{ isQuotation ? 'TOTAL' : 'NET TOTAL' }}</span><span>{{ currency }} {{ amount(doc.total_amount) }}</span></div>
    <template v-if="!isQuotation">
      <div class="print-receipt__line" />
      <div class="print-receipt__row"><span>{{ doc.payment_method === 'Cash' ? 'Cash Received' : `Paid by ${doc.payment_method}` }}</span><span>{{ amount(doc.amount_received) }}</span></div>
      <div v-if="doc.payment_method === 'Cash'" class="print-receipt__row font-weight-bold"><span>Change</span><span>{{ amount(doc.change_amount) }}</span></div>
      <div v-if="doc.refunded_amount > 0" class="print-receipt__row font-weight-bold"><span>Refunded</span><span>-{{ amount(doc.refunded_amount) }}</span></div>
    </template>
    <div class="print-receipt__line" />
    <div v-if="doc.note" class="text-center">{{ doc.note }}</div>
    <div class="text-center">{{ isQuotation ? 'Prices are valid until the date above.' : 'Thank you for your business!' }}</div>
  </div>

  <div v-else class="print-sheet print-a4">
    <div class="print-a4__head">
      <div>
        <div class="print-a4__business">{{ doc.vendor?.business_name }}</div>
        <div class="print-a4__muted">{{ doc.clientstore?.store_name }}</div>
        <div v-if="doc.clientstore?.address" class="print-a4__muted">{{ doc.clientstore.address }}</div>
        <div v-if="doc.clientstore?.store_phone" class="print-a4__muted">Tel: {{ doc.clientstore.store_phone }}</div>
      </div>
      <div class="text-right">
        <div class="print-a4__title">{{ isQuotation ? 'QUOTATION' : 'INVOICE' }}</div>
        <div class="print-a4__number">{{ number }}</div>
      </div>
    </div>

    <div class="print-a4__meta">
      <div class="print-a4__box">
        <div class="print-a4__label">{{ isQuotation ? 'Quotation for' : 'Bill to' }}</div>
        <div class="font-weight-bold">{{ doc.customer_name || 'Walk-in customer' }}</div>
        <div v-if="doc.customer_phone">{{ doc.customer_phone }}</div>
      </div>
      <div class="print-a4__box">
        <div class="print-a4__pair"><span>Date</span><span>{{ formatDateTime(doc.created_at) }}</span></div>
        <div v-if="isQuotation" class="print-a4__pair"><span>Valid until</span><span>{{ formatDate(doc.valid_until) }}</span></div>
        <div v-if="!isQuotation && doc.counter" class="print-a4__pair"><span>Counter</span><span>{{ doc.counter.name }}</span></div>
        <div class="print-a4__pair"><span>{{ isQuotation ? 'Prepared by' : 'Cashier' }}</span><span>{{ person }}</span></div>
        <div v-if="!isQuotation" class="print-a4__pair"><span>Payment</span><span>{{ doc.payment_method }}</span></div>
      </div>
    </div>

    <table class="print-a4__table">
      <thead>
        <tr>
          <th style="width: 40px">#</th>
          <th class="text-left">Item</th>
          <th style="width: 70px">Qty</th>
          <template v-if="showPrices">
            <th style="width: 110px">Rate</th>
            <th style="width: 110px">Discount</th>
            <th style="width: 120px">Amount</th>
          </template>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(item, index) in doc.items" :key="item.id">
          <td>{{ index + 1 }}</td>
          <td class="text-left">
            <div class="font-weight-bold">{{ item.product_name }}</div>
            <div class="print-a4__muted">{{ item.variant_name }}</div>
            <div v-if="item.returned_quantity > 0" class="print-a4__returned">Returned {{ formatNumber(item.returned_quantity, 3) }}</div>
          </td>
          <td>{{ formatNumber(item.quantity, 3) }}</td>
          <template v-if="showPrices">
            <td>{{ amount(item.unit_price) }}</td>
            <td>{{ item.item_discount + item.bill_discount > 0 ? `-${amount(item.item_discount + item.bill_discount)}` : '-' }}</td>
            <td class="font-weight-bold">{{ amount(item.total) }}</td>
          </template>
        </tr>
      </tbody>
    </table>

    <div class="print-a4__bottom">
      <div class="print-a4__notes">
        <div v-if="doc.note"><span class="print-a4__label">Note</span><div>{{ doc.note }}</div></div>
        <div class="print-a4__muted mt-2">{{ isQuotation ? 'Prices are valid until the date above. Stock is confirmed when the bill is made.' : 'Thank you for your business!' }}</div>
      </div>
      <div class="print-a4__totals">
        <template v-if="showPrices">
          <div class="print-a4__pair"><span>Subtotal</span><span>{{ amount(doc.subtotal) }}</span></div>
          <div v-if="doc.item_discount > 0" class="print-a4__pair"><span>Item discounts</span><span>-{{ amount(doc.item_discount) }}</span></div>
          <div v-for="discount in doc.bill_discounts" :key="discount.code" class="print-a4__pair">
            <span>Discount {{ discountLabel(discount) }} on {{ discount.lines }} items</span><span>-{{ amount(discount.amount) }}</span>
          </div>
        </template>
        <div class="print-a4__pair print-a4__grand"><span>Total</span><span>{{ currency }} {{ amount(doc.total_amount) }}</span></div>
        <template v-if="!isQuotation">
          <div class="print-a4__pair"><span>{{ doc.payment_method === 'Cash' ? 'Cash received' : `Paid by ${doc.payment_method}` }}</span><span>{{ amount(doc.amount_received) }}</span></div>
          <div v-if="doc.payment_method === 'Cash'" class="print-a4__pair"><span>Change</span><span>{{ amount(doc.change_amount) }}</span></div>
          <template v-if="doc.refunded_amount > 0">
            <div class="print-a4__pair print-a4__returned"><span>Refunded</span><span>-{{ amount(doc.refunded_amount) }}</span></div>
            <div class="print-a4__pair font-weight-bold"><span>Net after returns</span><span>{{ amount(doc.total_amount - doc.refunded_amount) }}</span></div>
          </template>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.print-sheet {
  background: #fff;
  color: #111;
}

.print-receipt {
  width: 300px;
  max-width: 100%;
  margin: 0 auto;
  padding: 14px 12px 18px;
  border: 1px solid #c3ccd8;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
  font-family: "Consolas", "Courier New", monospace;
  font-size: 11.5px;
  line-height: 1.45;
}

.print-receipt__title {
  font-size: 15px;
  font-weight: 700;
}

.print-receipt__heading {
  text-align: center;
  font-weight: 700;
  font-size: 13px;
  margin-bottom: 4px;
}

.print-receipt__line {
  border-top: 1px dashed #555;
  margin: 6px 0;
}

.print-receipt__row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.print-receipt__row > span:last-child {
  text-align: right;
}

.print-receipt__total {
  font-size: 14px;
  font-weight: 700;
  margin-top: 4px;
}

.print-receipt__items {
  width: 100%;
  border-collapse: collapse;
}

.print-receipt__items th,
.print-receipt__items td {
  padding: 0;
  text-align: right;
  font-weight: 400;
}

.print-receipt__items th {
  font-weight: 700;
  border-bottom: 1px solid #555;
}

.print-a4 {
  width: 190mm;
  max-width: 100%;
  min-height: 250mm;
  margin: 0 auto;
  padding: 12mm 12mm 14mm;
  border: 1px solid #d5dbe3;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12);
  font-family: "Manrope", Arial, sans-serif;
  font-size: 12px;
}

.print-a4__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding-bottom: 14px;
  border-bottom: 3px solid #1565c0;
}

.print-a4__business {
  font-size: 20px;
  font-weight: 700;
  color: #0f3460;
}

.print-a4__title {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 2px;
  color: #1565c0;
}

.print-a4__number {
  font-size: 14px;
  font-weight: 600;
}

.print-a4__muted {
  color: #5a6a85;
  font-size: 11.5px;
}

.print-a4__meta {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin: 16px 0;
}

.print-a4__box {
  padding: 10px 12px;
  border: 1px solid #e5eaef;
  border-radius: 6px;
}

.print-a4__label {
  font-size: 10.5px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #8a94a6;
  margin-bottom: 2px;
}

.print-a4__pair {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 2px 0;
}

.print-a4__table {
  width: 100%;
  border-collapse: collapse;
}

.print-a4__table th {
  background: #eef4fb;
  color: #0f3460;
  font-weight: 700;
  font-size: 11px;
  text-transform: uppercase;
  padding: 8px;
  text-align: right;
  border-bottom: 1px solid #d5dbe3;
}

.print-a4__table td {
  padding: 8px;
  text-align: right;
  border-bottom: 1px solid #eef1f5;
  vertical-align: top;
}

.print-a4__table th:first-child,
.print-a4__table td:first-child {
  text-align: center;
}

.print-a4__bottom {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  margin-top: 16px;
}

.print-a4__notes {
  flex: 1;
}

.print-a4__totals {
  width: 280px;
}

.print-a4__returned {
  color: #dc2626;
  font-size: 11.5px;
  font-weight: 600;
}

.print-a4__title--return {
  color: #dc2626;
}

.print-a4__grand--return {
  background: #dc2626 !important;
}

.print-a4__grand {
  margin: 6px 0;
  padding: 8px 10px !important;
  border-radius: 6px;
  background: #1565c0;
  color: #fff;
  font-size: 15px;
  font-weight: 700;
}
</style>
