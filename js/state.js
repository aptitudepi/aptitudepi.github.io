// Kyoto-inspired Universal Reactive State Store
// Architecture: component.Universal state serialization & event dispatch

const STATE_STORAGE_KEY = 'dvxb_universal_state_v1';

const defaultState = {
  theme: 'default',
  activeAiModel: 0,
  crtActive: false,
  noiseActive: false,
  soundEnabled: true,
  terminalHistory: []
};

function loadInitialState() {
  try {
    const raw = localStorage.getItem(STATE_STORAGE_KEY);
    return raw ? { ...defaultState, ...JSON.parse(raw) } : { ...defaultState };
  } catch (e) {
    return { ...defaultState };
  }
}

class UniversalStateStore {
  constructor() {
    this.state = loadInitialState();
    this.listeners = new Map();

    // Sync state changes across tabs
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === STATE_STORAGE_KEY && e.newValue) {
          try {
            const updated = JSON.parse(e.newValue);
            this.state = { ...this.state, ...updated };
            this.notify('*', this.state);
          } catch (_err) {}
        }
      });
    }
  }

  get(key) {
    return key ? this.state[key] : { ...this.state };
  }

  set(key, value) {
    if (typeof key === 'object') {
      this.state = { ...this.state, ...key };
      this.persist();
      this.notify('*', this.state);
      Object.keys(key).forEach(k => this.notify(k, key[k]));
    } else {
      if (this.state[key] === value) return;
      this.state[key] = value;
      this.persist();
      this.notify(key, value);
      this.notify('*', this.state);
    }
  }

  subscribe(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key).add(callback);

    // Initial trigger
    callback(key === '*' ? this.state : this.state[key]);

    return () => {
      const set = this.listeners.get(key);
      if (set) set.delete(callback);
    };
  }

  notify(key, value) {
    const set = this.listeners.get(key);
    if (set) {
      set.forEach(fn => {
        try { fn(value); } catch (e) { console.error('State listener error:', e); }
      });
    }
  }

  persist() {
    try {
      localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {}
  }
}

export const store = new UniversalStateStore();
