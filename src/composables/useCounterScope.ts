import { onMounted, ref } from 'vue';
import axios from 'axios';
import { useAuthStore } from '@/stores/auth';

export function useCounterScope() {
    const authStore = useAuthStore();
    const all = ref(true);
    const counter = ref<{ id: number; name: string } | null>(null);

    async function load() {
        if (!authStore.clientstoreId) return;
        try {
            const data = (await axios.get('counters/mine', { params: { clientstore_id: authStore.clientstoreId } })).data;
            all.value = data.all;
            counter.value = data.counter;
        } catch (error) {
            console.error('Failed to load counter scope', error);
        }
    }

    onMounted(load);

    return { all, counter, load };
}
