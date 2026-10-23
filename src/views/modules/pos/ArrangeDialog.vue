<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
  modelValue: boolean;
  title: string;
  icon: string;
  items: any[];
  saving?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'save', ids: number[]): void;
}>();

const rows = ref<any[]>([]);

function move(index: number, to: number) {
  if (to < 0 || to >= rows.value.length || to === index) return;
  const [row] = rows.value.splice(index, 1);
  rows.value.splice(to, 0, row);
}

watch(() => props.modelValue, (open) => {
  if (open) rows.value = [...props.items];
});
</script>

<template>
  <v-dialog :model-value="modelValue" max-width="560" scrollable @update:model-value="emit('update:modelValue', $event)">
    <v-card class="ui-modal">
      <div class="ui-modal__header">
        <div class="d-flex align-center ga-3">
          <v-icon color="white">{{ icon }}</v-icon>
          <span class="ui-modal__title">{{ title }}</span>
        </div>
        <button class="ui-modal__close" type="button" aria-label="Close" @click="emit('update:modelValue', false)">
          <v-icon size="18">mdi-close</v-icon>
        </button>
      </div>

      <v-card-text class="arrange-dialog__body">
        <draggable v-model="rows" handle=".arrange-row__handle" :animation="150">
          <div v-for="(row, index) in rows" :key="row.id" class="arrange-row">
            <v-icon class="arrange-row__handle" size="20">mdi-drag-vertical</v-icon>
            <span class="arrange-row__number">{{ index + 1 }}</span>
            <span class="arrange-row__logo">
              <img v-if="row.image_url" :src="row.image_url" :alt="row.name" />
              <span v-else>{{ row.name.charAt(0) }}</span>
            </span>
            <span class="arrange-row__name">{{ row.name }}</span>
            <v-btn icon="mdi-arrow-collapse-up" size="x-small" variant="text" color="primary" :disabled="index === 0" title="Move to top" @click="move(index, 0)" />
            <v-btn icon="mdi-arrow-up" size="x-small" variant="text" color="primary" :disabled="index === 0" title="Move up" @click="move(index, index - 1)" />
            <v-btn icon="mdi-arrow-down" size="x-small" variant="text" color="primary" :disabled="index === rows.length - 1" title="Move down" @click="move(index, index + 1)" />
            <v-btn icon="mdi-arrow-collapse-down" size="x-small" variant="text" color="primary" :disabled="index === rows.length - 1" title="Move to bottom" @click="move(index, rows.length - 1)" />
          </div>
        </draggable>
      </v-card-text>

      <div class="ui-modal__divider" />
      <div class="arrange-dialog__footer">
        <v-btn variant="outlined" color="primary" @click="emit('update:modelValue', false)">Cancel</v-btn>
        <v-btn color="primary" variant="flat" prepend-icon="mdi-content-save-outline" :loading="saving" @click="emit('save', rows.map((row) => row.id))">Save</v-btn>
      </div>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.arrange-dialog__body {
  padding: 12px 16px !important;
  background: rgb(var(--v-theme-grey50));
}

.arrange-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  margin-bottom: 6px;
  border: 1px solid rgb(var(--v-theme-borderColor));
  border-radius: 10px;
  background: #fff;
}

.arrange-row__handle {
  cursor: grab;
  color: rgb(var(--v-theme-lightgray));
}

.arrange-row__number {
  width: 22px;
  font-size: 12px;
  font-weight: 700;
  color: rgb(var(--v-theme-lightgray));
}

.arrange-row__logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  border: 1px solid rgb(var(--v-theme-borderColor));
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
  font-weight: 700;
  color: rgb(var(--v-theme-primary));
}

.arrange-row__logo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.arrange-row__name {
  flex-grow: 1;
  font-size: 14px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.arrange-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px;
}
</style>
