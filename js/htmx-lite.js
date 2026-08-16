// Kyoto-inspired Hypermedia Partial DOM Swapping Library (HTMX-lite)
// Architecture: kyoto/htmx partial DOM swaps & morphing

/**
 * Perform a dynamic DOM swap on a target element with optional animation.
 * @param {Element|string} target - Target element or CSS selector.
 * @param {string} html - HTML string to insert/swap.
 * @param {string} mode - Swap mode: 'outerHTML', 'innerHTML', 'beforeEnd', 'afterBegin'.
 * @param {boolean} animate - Apply fade-in animation to swapped nodes.
 */
export function swapHTML(target, html, mode = 'innerHTML', animate = true) {
  const container = typeof target === 'string' ? document.querySelector(target) : target;
  if (!container) return null;

  // Parse HTML string into DOM nodes
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  const fragment = template.content;
  const newNodes = Array.from(fragment.childNodes);

  if (animate) {
    newNodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        node.style.opacity = '0';
        node.style.transition = 'opacity 0.25s ease-in-out, transform 0.25s ease-in-out';
        node.style.transform = 'translateY(4px)';
      }
    });
  }

  let insertedElements = [];

  switch (mode) {
    case 'outerHTML': {
      const parent = container.parentNode;
      if (parent) {
        newNodes.forEach(node => {
          const inserted = parent.insertBefore(node, container);
          if (inserted.nodeType === Node.ELEMENT_NODE) insertedElements.push(inserted);
        });
        parent.removeChild(container);
      }
      break;
    }
    case 'beforeEnd':
    case 'append': {
      newNodes.forEach(node => {
        const inserted = container.appendChild(node);
        if (inserted.nodeType === Node.ELEMENT_NODE) insertedElements.push(inserted);
      });
      break;
    }
    case 'afterBegin':
    case 'prepend': {
      const firstChild = container.firstChild;
      newNodes.forEach(node => {
        const inserted = container.insertBefore(node, firstChild);
        if (inserted.nodeType === Node.ELEMENT_NODE) insertedElements.push(inserted);
      });
      break;
    }
    case 'innerHTML':
    default: {
      container.innerHTML = '';
      newNodes.forEach(node => {
        const inserted = container.appendChild(node);
        if (inserted.nodeType === Node.ELEMENT_NODE) insertedElements.push(inserted);
      });
      break;
    }
  }

  // Trigger smooth enter animation
  if (animate && insertedElements.length) {
    requestAnimationFrame(() => {
      insertedElements.forEach(el => {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      });
    });
  }

  return insertedElements;
}
