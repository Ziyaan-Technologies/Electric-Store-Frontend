import { formatMoney } from '@/utils/api';

export type DiscountType = 'percent' | 'amount';

export interface BillLine {
    key?: string;
    product_id?: number | null;
    variant_id?: number | null;
    product_name: string;
    variant_name?: string;
    image_url?: string | null;
    quantity: number;
    original_price: number;
    unit_price: number;
    cost_price?: number | null;
    stock?: number | null;
    discount_type: DiscountType;
    discount_value: number;
    bill_discount_code?: string | null;
    is_outside?: boolean;
    creditor_id?: number | null;
    creditor_name?: string;
}

export interface BillDiscount {
    code: string;
    type: DiscountType;
    value: number;
}

export interface LineAmounts {
    gross: number;
    item_discount: number;
    bill_discount: number;
    total: number;
}

export const round = (value: number) => Math.round((Number(value) || 0) * 100) / 100;

function itemDiscount(line: BillLine, gross: number) {
    const value = Math.max(0, Number(line.discount_value) || 0);
    if (!value) return 0;
    return round(Math.min(gross, line.discount_type === 'percent' ? gross * Math.min(value, 100) / 100 : value));
}

export function activeDiscounts(lines: BillLine[], discounts: BillDiscount[]) {
    return discounts.filter((discount) => lines.some((line) => line.bill_discount_code === discount.code));
}

export function calculateBill(lines: BillLine[], discounts: BillDiscount[]) {
    const amounts: LineAmounts[] = lines.map((line) => {
        const gross = round((Number(line.quantity) || 0) * (Number(line.unit_price) || 0));
        const discount = itemDiscount(line, gross);
        return { gross, item_discount: discount, bill_discount: 0, total: round(gross - discount) };
    });

    const groups = activeDiscounts(lines, discounts).map((discount) => {
        const indexes = lines.map((line, index) => (line.bill_discount_code === discount.code ? index : -1)).filter((index) => index >= 0);
        const base = round(indexes.reduce((sum, index) => sum + amounts[index].total, 0));
        const value = Math.max(0, Number(discount.value) || 0);
        const target = round(Math.min(base, discount.type === 'percent' ? base * Math.min(value, 100) / 100 : value));
        let given = 0;
        indexes.forEach((index, position) => {
            const share = position === indexes.length - 1
                ? round(target - given)
                : base ? round(target * amounts[index].total / base) : 0;
            given = round(given + share);
            amounts[index].bill_discount = share;
            amounts[index].total = round(amounts[index].total - share);
        });
        return { ...discount, base, amount: target, lines: indexes.length };
    });

    const totals = amounts.reduce((sum, row) => ({
        subtotal: round(sum.subtotal + row.gross),
        item_discount: round(sum.item_discount + row.item_discount),
        bill_discount: round(sum.bill_discount + row.bill_discount),
        total: round(sum.total + row.total),
    }), { subtotal: 0, item_discount: 0, bill_discount: 0, total: 0 });

    return { lines: amounts, discounts: groups, ...totals };
}

export function nextDiscountCode(discounts: BillDiscount[]) {
    const used = discounts.map((discount) => Number(discount.code.replace(/\D/g, '')) || 0);
    return `D${(used.length ? Math.max(...used) : 0) + 1}`;
}

export function discountLabel(discount: { type: DiscountType; value: number }) {
    return discount.type === 'percent' ? `${Number(discount.value)}%` : formatMoney(discount.value);
}
