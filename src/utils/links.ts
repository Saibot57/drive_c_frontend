/** Första http(s)-länken i en text, eller null. Kortets kategori kan bära en uppgiftslänk. */
export const extractUrl = (value?: string): string | null => {
  if (!value) return null;
  const match = value.match(/https?:\/\/[^\s]+/i);
  return match ? match[0] : null;
};
