/** Fisher–Yates shuffle bag — each quote once per cycle, then reshuffle. */
export function createQuotePicker(quotes: readonly string[]): (avoid?: string) => string {
  let bag: number[] = [];

  const refill = (): void => {
    bag = quotes.map((_, i) => i);
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
  };

  return (avoid?: string): string => {
    if (quotes.length === 0) return '';
    if (bag.length === 0) refill();

    let idx = bag.pop()!;
    let quote = quotes[idx]!;
    if (avoid && quote === avoid && bag.length > 0) {
      const retry = bag.pop()!;
      bag.push(idx);
      idx = retry;
      quote = quotes[idx]!;
    }
    return quote;
  };
}
