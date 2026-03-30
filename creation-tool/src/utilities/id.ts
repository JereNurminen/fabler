export function generateId(): string {
  const value = Math.floor(Math.random() * 0x100000);
  return value.toString(16).padStart(5, "0");
}
