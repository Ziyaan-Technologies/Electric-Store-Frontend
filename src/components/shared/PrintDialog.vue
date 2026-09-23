<script setup lang="ts">
import { ref, watch } from 'vue';
import DocumentPrint from '@/components/shared/DocumentPrint.vue';
import { printElement, rememberPaper, savedPaper, type Paper } from '@/utils/print';

const props = withDefaults(defineProps<{
  modelValue: boolean;
  doc: any;
  kind: 'bill' | 'quotation' | 'return';
  title?: string;
  autoPrint?: boolean;
}>(), {
  title: '',
  autoPrint: false,
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const paper = ref<Paper>(savedPaper());
const sheet = ref<HTMLElement | null>(null);

function number() {
  if (props.kind === 'quotation') return props.doc?.quotation_number;
  if (props.kind === 'return') return props.doc?.return_number;
  return props.doc?.bill_number;
}

function choose(value: Paper) {
  paper.value = value;
  rememberPaper(value);
}

function print() {
  const element = sheet.value?.firstElementChild as HTMLElement | null;
  if (element) printElement(element, paper.value, number());
}

watch(() => props.modelValue, (open) => {
  if (open) {
    paper.value = savedPaper();
    if (props.autoPrint) setTimeout(print, 400);
  }
});
</script>

<template>
  <v-dialog :model-value="modelValue" max-width="900" scrollable @update:model-value="emit('update:modelValue', $event)">
    <v-card class="ui-modal">
      <div class="ui-modal__header">
        <div>
          <span class="ui-modal__title">{{ title || (kind === 'quotation' ? 'Print Quotation' : kind === 'return' ? 'Print Return Slip' : 'Print Bill') }}</span>
          <div class="print-dialog__subtitle">{{ number() }}</div>
        </div>
        <button class="ui-modal__close" type="button" aria-label="Close" @click="emit('update:modelValue', false)">
          <v-icon size="18">mdi-close</v-icon>
        </button>
      </div>
      <div class="print-dialog__bar">
        <span class="text-subtitle-2">Paper</span>
        <v-btn-toggle :model-value="paper" mandatory density="comfortable" color="primary" variant="outlined" divided @update:model-value="choose">
          <v-btn value="a4" prepend-icon="mdi-file-document-outline" class="text-none">A4</v-btn>
          <v-btn value="80mm" prepend-icon="mdi-receipt-text-outline" class="text-none">80 mm Receipt</v-btn>
        </v-btn-toggle>
        <v-spacer />
        <slot name="actions" />
        <v-btn color="primary" variant="flat" prepend-icon="mdi-printer" @click="print">Print</v-btn>
      </div>
      <v-card-text class="print-dialog__preview">
        <div v-if="doc" ref="sheet">
          <DocumentPrint :doc="doc" :kind="kind" :paper="paper" />
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.print-dialog__subtitle {
  font-size: 12.5px;
  color: rgba(255, 255, 255, 0.85);
}

.print-dialog__bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 12px 20px;
  border-bottom: 1px solid rgb(var(--v-theme-borderColor));
}

.print-dialog__preview {
  background: #eef1f5;
  padding: 20px !important;
}
</style>
