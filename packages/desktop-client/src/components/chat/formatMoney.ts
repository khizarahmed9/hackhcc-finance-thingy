import { send } from '@actual-app/core/platform/client/connection';
import { getCurrency } from '@actual-app/core/shared/currencies';
import {
  amountToInteger,
  integerToCurrency,
} from '@actual-app/core/shared/util';

/**
 * Money formatting for assistant prose.
 *
 * `integerToCurrency` groups digits but omits the symbol, matching Actual's
 * bare table figures. In a sentence — an insight, or a receipt of a change —
 * a bare number reads as a bug next to the model's own "$12.83", so the
 * user's configured currency symbol goes back on.
 */

let symbolPromise: Promise<string> | null = null;

function loadSymbol(): Promise<string> {
  symbolPromise ??= (async () => {
    try {
      const prefs = (await send('preferences/get')) as {
        defaultCurrencyCode?: string;
      };
      return getCurrency(prefs?.defaultCurrencyCode || '')?.symbol || '$';
    } catch {
      return '$';
    }
  })();
  return symbolPromise;
}

/** Clears the cached symbol; call if the currency preference changes. */
export function resetCurrencySymbol() {
  symbolPromise = null;
}

export async function formatMoney(amount: number): Promise<string> {
  const grouped = integerToCurrency(amountToInteger(amount));
  const symbol = await loadSymbol();
  return `${symbol}${grouped}`;
}
