const STORAGE_KEY = 'tradingJournal.v1';

/**
 * DataStore is intentionally isolated so it can be swapped later
 * with Firebase/Supabase (same API shape).
 */
export const dataStore = {
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { trades: [], account: { balance: 0, startingBalance: 0 } };
      const parsed = JSON.parse(raw);
      return {
        trades: Array.isArray(parsed.trades) ? parsed.trades : [],
        account: parsed.account || { balance: 0, startingBalance: 0 },
      };
    } catch {
      return { trades: [], account: { balance: 0, startingBalance: 0 } };
    }
  },

  save(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  },

  reset() {
    localStorage.removeItem(STORAGE_KEY);
  },

  /**
   * Import/export helpers
   */
  exportJSON() {
    return JSON.stringify(this.load(), null, 2);
  },

  importJSON(text) {
    const parsed = JSON.parse(text);
    const next = {
      trades: Array.isArray(parsed.trades) ? parsed.trades : [],
      account: parsed.account || { balance: 0, startingBalance: 0 },
    };
    this.save(next);
    return next;
  },
};

