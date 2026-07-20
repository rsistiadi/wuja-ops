export function formatIDR(amount) {
  return "Rp " + Math.round(amount || 0).toLocaleString("id-ID");
}

export const PAYMENT_METHOD_OPTIONS = [
  { value: "cash", label: "Cash" },
  { value: "qris", label: "QRIS" },
  { value: "card", label: "Card" },
];
