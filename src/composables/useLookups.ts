import { ref } from 'vue';
import axios from 'axios';
import { useAuthStore } from '@/stores/auth';

export function useLookups() {
    const authStore = useAuthStore();
    const categories = ref<any[]>([]);
    const brands = ref<any[]>([]);
    const roles = ref<any[]>([]);
    const shops = ref<any[]>([]);
    const counters = ref<any[]>([]);

    const scope = () => ({ params: { clientstore_id: authStore.clientstoreId } });

    const loadCategories = async () => {
        categories.value = (await axios.get('categories/list', scope())).data;
    };
    const loadBrands = async () => {
        brands.value = (await axios.get('brands/list', scope())).data;
    };
    const loadRoles = async () => {
        roles.value = (await axios.get('roles/list')).data;
    };
    const loadShops = async () => {
        shops.value = (await axios.get('clientstores/list')).data;
    };
    const loadCounters = async () => {
        counters.value = (await axios.get('counters/list', scope())).data;
    };

    return { categories, brands, roles, shops, counters, loadCategories, loadBrands, loadRoles, loadShops, loadCounters };
}
