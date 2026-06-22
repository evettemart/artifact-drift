import { buildSeed, type MockState } from "@/mocks/seed";

const STORAGE_KEY = "adc.mock.v1";

/**
 * Mutable in-memory store backing the MSW handlers. Persists to localStorage so
 * mutations (acknowledge/suppress/create) survive a page refresh. `reset()`
 * rebuilds from the seed fixtures and is wired to the Dev menu.
 */
class MockStore {
  private state: MockState;

  constructor() {
    this.state = this.load();
  }

  private load(): MockState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as MockState;
    } catch {
      // ignore corrupt/unavailable storage, fall through to seed
    }
    const seed = buildSeed();
    this.persistState(seed);
    return seed;
  }

  private persistState(state: MockState) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage may be unavailable (private mode); in-memory still works
    }
  }

  private persist() {
    this.persistState(this.state);
  }

  get(): MockState {
    return this.state;
  }

  update(mutator: (state: MockState) => void) {
    mutator(this.state);
    this.persist();
  }

  reset() {
    this.state = buildSeed();
    this.persist();
  }
}

export const mockStore = new MockStore();
