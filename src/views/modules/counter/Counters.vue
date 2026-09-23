<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import UiParentCard from '@/components/shared/UiParentCard.vue';
import ListToolbar from '@/components/shared/ListToolbar.vue';
import TableBottom from '@/components/shared/TableBottom.vue';
import RightDrawer from '@/components/shared/RightDrawer.vue';
import DeleteDialog from '@/components/shared/DeleteDialog.vue';
import ActiveIcon from '@/components/shared/ActiveIcon.vue';
import StatusChip from '@/components/shared/StatusChip.vue';
import CloseCounterDialog from './CloseCounterDialog.vue';
import { useListPage } from '@/composables/useListPage';
import { useAlerts } from '@/composables/useAlerts';
import { useAuthStore } from '@/stores/auth';
import { usePendingStore } from '@/stores/pending';
import { can } from '@/utils/permissions';
import { formatDateTime, formatMoney, rules } from '@/utils/api';
import type { Header } from '@/models/type-interfaces';

const router = useRouter();
const authStore = useAuthStore();
const pending = usePendingStore();
const alerts = useAlerts();
const drawerAlerts = useAlerts();

const list = useListPage('counters', {
  kpis: false,
  storeScoped: true,
  onError: (error) => alerts.fail(error),
});

const headers = ref<Header[]>([
  { title: 'ID', align: 'start', key: 'id' },
  { title: 'COUNTER', align: 'start', key: 'name' },
  { title: 'STATUS', align: 'start', key: 'status' },
  { title: 'CASH IN COUNTER', align: 'start', key: 'cash' },
  { title: 'TODAY', align: 'start', key: 'today' },
  { title: 'ACTIVE', align: 'start', key: 'is_active' },
  { title: 'ACTIONS', key: 'actions', sortable: false },
]);

const drawer = ref(false);
const drawerRef = ref<any>(null);
const saving = ref(false);
const editingId = ref<number | null>(null);
const form = ref<any>({});
const deleteOpen = ref(false);
const deleteId = ref<number | null>(null);
const closeOpen = ref(false);
const closeSessionId = ref<number | null>(null);

function openForm(item: any = null) {
  editingId.value = item?.id || null;
  form.value = { name: item?.name || '', description: item?.description || '', drawer_cash: item?.drawer_cash ?? 0, is_active: item?.is_active ?? true };
  drawerAlerts.clear();
  drawer.value = true;
  drawerRef.value?.resetValidation();
}

async function save() {
  if (!(await drawerRef.value.validate())) return;
  saving.value = true;
  try {
    const payload = { ...form.value, name: form.value.name.trim(), clientstore_id: authStore.clientstoreId };
    if (editingId.value) {
      await axios.put(`counters/${editingId.value}`, payload);
      alerts.success('Counter has been updated!');
    } else {
      await axios.post('counters', payload);
      alerts.success('Counter has been created!');
    }
    drawer.value = false;
    list.refresh();
  } catch (error) {
    drawerAlerts.fail(error);
  } finally {
    saving.value = false;
  }
}

function openDelete(item: any) {
  deleteId.value = item.id;
  deleteOpen.value = true;
}

async function remove() {
  try {
    const response = await axios.delete(`counters/${deleteId.value}`);
    alerts.success(response.data?.message || 'Counter has been deleted!');
    list.refresh();
  } catch (error) {
    alerts.fail(error);
  }
}

function openClose(item: any) {
  closeSessionId.value = item.session.id;
  closeOpen.value = true;
}

function onClosed() {
  alerts.success('Counter closed');
  list.refresh();
  pending.refresh();
}
</script>

<template>
  <v-row>
    <v-col cols="12">
      <UiParentCard>
        <ListToolbar :total="list.totalItems.value" label="Counters" search-placeholder="Search counter..." add-label="Add New Counter"
          :can-add="can('counters_create', 'Counter')" @search="list.onSearch" @add="openForm()" />

        <v-data-table :loading="list.loading.value" :items-per-page="list.itemsPerPage.value" :headers="headers" :items="list.items.value"
          item-value="id" hide-default-footer class="border rounded-md">
          <template v-slot:loading><v-skeleton-loader type="table-row@10"></v-skeleton-loader></template>
          <template v-slot:top>
            <v-alert v-model="alerts.showAlert.value" :text="alerts.alertText.value" type="success" density="compact" class="mb-4 single-line-alert" closable>
              <template v-slot:prepend><v-icon class="text-24">mdi-checkbox-marked-circle-outline</v-icon></template>
            </v-alert>
            <v-alert v-model="alerts.showErrorAlert.value" :text="alerts.errorText.value" type="error" density="compact" class="mb-4 single-line-alert" closable />
          </template>
          <template v-slot:item.name="{ item }">
            <div class="d-flex align-center py-2">
              <v-avatar size="34" rounded="md" :color="item.status === 'Open' ? 'lightsuccess' : 'grey100'">
                <v-icon size="18" :color="item.status === 'Open' ? 'success' : 'primary'">mdi-counter</v-icon>
              </v-avatar>
              <div class="ml-3">
                <div class="text-subtitle-2">{{ item.name }}</div>
                <div v-if="item.description" class="text-caption text-lightText">{{ item.description }}</div>
              </div>
            </div>
          </template>
          <template v-slot:item.status="{ item }">
            <StatusChip :status="item.status" />
            <div v-if="item.session" class="text-caption text-lightText">{{ item.session.cashier?.full_name }} · since {{ formatDateTime(item.session.opened_at) }}</div>
            <div v-if="item.session?.totals.pending_costs" class="text-caption text-error font-weight-bold">{{ item.session.totals.pending_costs }} bought price(s) pending</div>
          </template>
          <template v-slot:item.cash="{ item }">
            <span v-if="item.session" class="font-weight-bold">{{ formatMoney(item.session.totals.cash_now) }}</span>
            <div v-else-if="item.last_session">
              <div>{{ formatMoney(item.last_session.closing_cash) }}</div>
              <div class="text-caption text-lightText">counted at last close<span v-if="item.last_session.cash_difference" :class="item.last_session.cash_difference < 0 ? 'text-error' : 'text-orange'"> · {{ item.last_session.cash_difference < 0 ? 'short' : 'over' }} {{ formatMoney(Math.abs(item.last_session.cash_difference)) }}</span></div>
            </div>
            <span v-else class="text-lightText">-</span>
          </template>
          <template v-slot:item.today="{ item }">{{ item.today.bills }} bills · {{ formatMoney(item.today.sales) }}</template>
          <template v-slot:item.is_active="{ item }"><ActiveIcon :active="item.is_active" /></template>
          <template v-slot:item.actions="{ item }">
            <div class="d-flex align-center ga-1">
              <v-btn v-if="can('counters_cash_flow', 'Counter')" color="primary" variant="tonal" size="small" prepend-icon="mdi-swap-vertical"
                @click="router.push(`/counters/${item.id}/cash-flow`)">Cash Flow</v-btn>
              <v-btn v-if="item.session && can('counters_open_close', 'Counter')" icon="mdi-lock-outline" color="#FFEFEF" size="small" class="text-error" title="Close counter" @click="openClose(item)" />
              <v-btn v-if="can('counters_edit', 'Counter')" icon="mdi-pencil-outline" color="#EFF0F1" size="small" @click="openForm(item)" />
              <v-btn v-if="can('counters_delete', 'Counter')" icon="mdi-delete-outline" color="#FFEFEF" size="small" class="text-error" @click="openDelete(item)" />
            </div>
          </template>
          <template v-slot:no-data><p class="px-2 py-2">No counters yet</p></template>
          <template v-slot:bottom>
            <TableBottom v-model:page="list.currentPage.value" :page-count="list.pageCount.value" v-model:per-page="list.itemsPerPageInput.value" :total="list.totalItems.value" />
          </template>
        </v-data-table>
      </UiParentCard>
    </v-col>
  </v-row>

  <RightDrawer ref="drawerRef" v-model="drawer" :title="editingId ? 'Edit Counter' : 'Add New Counter'" icon="mdi-counter"
    :subtitle="authStore.storeName || ''" :submit-label="editingId ? 'Update Counter' : 'Create Counter'" :loading="saving"
    :show-error-alert="drawerAlerts.showErrorAlert.value" :error-text="drawerAlerts.errorText.value" @submit="save" @close-error="drawerAlerts.clear()">
    <v-row>
      <v-col cols="12" class="pt-4">
        <v-label class="text-subtitle-1 pb-2 text-lightText">Name</v-label>
        <v-text-field v-model="form.name" :rules="[rules.required]" placeholder="e.g. Counter 3" hide-details="auto" />
      </v-col>
      <v-col cols="12">
        <v-label class="text-subtitle-1 pb-2 text-lightText">Description</v-label>
        <v-text-field v-model="form.description" hide-details placeholder="e.g. Near the entrance" />
      </v-col>
      <v-col v-if="!editingId" cols="12">
        <v-label class="text-subtitle-1 pb-2 text-lightText">Cash kept in counter</v-label>
        <v-text-field v-model="form.drawer_cash" type="number" min="0" hide-details />
      </v-col>
      <v-col cols="12" class="pb-0 d-flex align-center justify-space-between">
        <p class="text-subtitle-1 font-weight-bold" :class="{ 'text-primary': form.is_active }">Active?</p>
        <v-switch color="primary" v-model="form.is_active" hide-details></v-switch>
      </v-col>
    </v-row>
  </RightDrawer>

  <DeleteDialog v-model="deleteOpen" message="Are you sure you want to delete this counter?" hint="Counters with old sessions are made inactive instead." @confirm="remove" />
  <CloseCounterDialog v-model="closeOpen" :session-id="closeSessionId" @closed="onClosed" />
</template>
