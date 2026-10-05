import { pickRandomItem } from './pickRandomItem';

describe('pickRandomItem', () => {
  test.each([
    [0, 'yellow'],
    [0.49, 'blue'],
    [0.99, 'green'],
  ])('selects one item without reordering the input for random value %s', (randomValue, expected) => {
    const items = ['yellow', 'blue', 'green'];

    expect(pickRandomItem(items, () => randomValue)).toBe(expected);
    expect(items).toEqual(['yellow', 'blue', 'green']);
  });

  test('rejects an empty collection', () => {
    expect(() => pickRandomItem([], () => 0)).toThrow('items must be a non-empty array.');
  });
});
