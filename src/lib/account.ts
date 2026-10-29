export function validateAccountProfile(f: { full_name: string; username: string; whatsapp: string }): string[] {
  const e: string[] = [];
  const n = f.full_name.trim();
  if (n.length < 2 || n.length > 60) e.push("Nama 2–60 karakter");
  if (f.username && !/^[a-z0-9_.]{3,30}$/.test(f.username)) e.push("Username 3–30 karakter: huruf kecil, angka, titik, atau _");
  if (f.whatsapp && !/^(08|628)\d{7,12}$/.test(f.whatsapp)) e.push("No HP harus diawali 08 atau 628");
  return e;
}
