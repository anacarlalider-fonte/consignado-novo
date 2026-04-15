export function isValidFollowupDate(value: string) {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return false;
  const [dd, mm, yyyy] = value.split("/").map(Number);
  const date = new Date(`${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}T00:00:00`);
  return (
    date.getFullYear() === yyyy &&
    date.getMonth() + 1 === mm &&
    date.getDate() === dd &&
    yyyy >= 2020 &&
    yyyy <= 2100
  );
}

export function normalizeMoneyInput(value: string) {
  const clean = value.replace(/[^\d,.-]/g, "").replace(",", ".");
  const num = Number(clean);
  if (!Number.isFinite(num) || num < 0) return 0;
  return num;
}
