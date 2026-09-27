export const money = (cents) => `$${((cents || 0) / 100).toFixed(2)}`;
export const stars = (n) => '★'.repeat(Math.round(n || 0)) + '☆'.repeat(5 - Math.round(n || 0));
