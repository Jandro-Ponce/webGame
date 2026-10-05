export function pickRandomItem(items, random = Math.random) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('items must be a non-empty array.');
  }

  return items[Math.floor(random() * items.length)];
}
