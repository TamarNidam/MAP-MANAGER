export function nextDefaultName(prefix: string, names: string[]): string {
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^${escapedPrefix}\\s+(\\d+)$`, "i");
  const maximum = names.reduce((max, name) => {
    const match = pattern.exec(name.trim());
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `${prefix} ${maximum + 1}`;
}
