<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ status: string }>();

const colors: Record<string, string> = {
  'Draft': 'gray',
  'Approved': 'purple',
  'Partially Received': 'orange',
  'Received': 'green',
  'Posted': 'green',
  'Dispatched': 'orange',
  'Cancelled': 'red',
  'Completed': 'green',
  'Partially Returned': 'orange',
  'Returned': 'red',
  'Open': 'green',
  'Closed': 'gray',
  'In Stock': 'green',
  'Low Stock': 'orange',
  'Out of Stock': 'red',
  'Converted': 'green',
  'Expired': 'red',
  'Pending': 'orange',
  'Entered': 'green',
  'In Use': 'green',
  'Free': 'gray',
};

const color = computed(() => colors[props.status] || 'gray');
</script>

<template>
  <span class="ui-status-chip" :class="`ui-status-chip--${color}`">{{ status }}</span>
</template>
