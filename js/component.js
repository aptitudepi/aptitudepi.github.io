// Kyoto-inspired Component Lifecycle & Async Futures Library
// Architecture: component.Context, component.Future, component.State

const registry = new Map();
const activeInstances = new Map();

/**
 * Define a new component with init, fetch, render, and destroy lifecycle methods.
 */
export function defineComponent(name, factory) {
  registry.set(name, factory);
}

/**
 * Create a non-blocking Future for component async data loading.
 */
export function createFuture(asyncFn) {
  let status = 'pending';
  let result = null;
  let error = null;
  const listeners = [];

  const promise = (async () => {
    try {
      result = await asyncFn();
      status = 'resolved';
    } catch (e) {
      error = e;
      status = 'rejected';
    }
    listeners.forEach(fn => fn(status, result, error));
  })();

  return {
    getStatus: () => status,
    getResult: () => result,
    getError: () => error,
    onComplete: (fn) => {
      if (status !== 'pending') {
        fn(status, result, error);
      } else {
        listeners.push(fn);
      }
    },
    promise
  };
}

/**
 * Mount a registered component into a DOM element.
 */
export async function mountComponent(selectorOrEl, name, props = {}) {
  const container = typeof selectorOrEl === 'string' ? document.querySelector(selectorOrEl) : selectorOrEl;
  if (!container) return null;

  const factory = registry.get(name);
  if (!factory) {
    console.warn(`Component "${name}" not found in registry.`);
    return null;
  }

  const ctx = {
    container,
    props,
    state: {},
    futures: {},
    update: () => instance.render()
  };

  const instance = factory(ctx);
  activeInstances.set(container, instance);

  if (instance.init) {
    instance.init();
  }

  if (instance.render) {
    instance.render();
  }

  if (instance.fetch) {
    const fetchFuture = createFuture(() => instance.fetch());
    fetchFuture.onComplete((status) => {
      if (status === 'resolved' && instance.render) {
        instance.render();
      }
    });
  }

  return instance;
}

/**
 * Unmount component from a DOM element.
 */
export function unmountComponent(selectorOrEl) {
  const container = typeof selectorOrEl === 'string' ? document.querySelector(selectorOrEl) : selectorOrEl;
  if (!container) return;

  const instance = activeInstances.get(container);
  if (instance) {
    if (instance.destroy) {
      instance.destroy();
    }
    activeInstances.delete(container);
  }
}
