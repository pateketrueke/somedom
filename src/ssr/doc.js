import { CLOSE_TAGS } from '../lib/shared';
import Fragment from '../lib/fragment';
import {
  tick, isNot,
} from '../lib/util';

export class Event {
  constructor(type, params) {
    Object.assign(this, { type, ...params });
  }
}

export class Node {
  constructor(props) {
    Object.keys(props).forEach(key => {
      Object.defineProperty(this, key, Object.getOwnPropertyDescriptor(props, key));
    });
  }
}

export class Text extends Node {}
export class Comment extends Node {}
export class HTMLElement extends Node {}

export function mount(node, el) {
  if (node instanceof Fragment) {
    node.childNodes.forEach(sub => mount(sub, el));
  } else {
    Object.defineProperty(node, 'parentNode', { configurable: true, value: el });
  }
}

export function remove() {
  this.parentNode.removeChild(this);
}

export function replace(node) {
  if (this.parentNode) {
    this.parentNode.replaceChild(node, this);
  }
}

export function withText(value, key) {
  return this.findText(value)[key || 0];
}

export function findText(value) {
  const found = [];

  function walk(sub, nodes) {
    for (let i = 0; i < nodes.length; i += 1) {
      if (nodes[i].childNodes) walk(nodes[i], nodes[i].childNodes);
      if (nodes[i].nodeValue) {
        if (value instanceof RegExp && value.test(nodes[i].nodeValue)) found.push(sub);
        else if (nodes[i].nodeValue.indexOf(value) !== -1) found.push(sub);
      }
    }
  }

  // istanbul ignore next
  const _Event = typeof window !== 'undefined' ? window.Event : Event;

  walk(this, this.childNodes);

  found.forEach(node => {
    // istanbul ignore next
    if (!node.dispatch) {
      node.dispatch = (type, params) => {
        node.dispatchEvent(new _Event(type, params));
      };
    }
  });

  return found;
}

export function bindHelpers(target) {
  return Object.assign(target, { withText, findText });
}

export function encodeText(value) {
  return String(value)
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function dispatchEvent(e) {
  (this.eventListeners[e.type] || []).map(cb => cb({
    currentTarget: this,
    ...e,
  }));
}

export function addEventListener(name, callback) {
  (this.eventListeners[name] || (this.eventListeners[name] = [])).push(callback);
}

export function removeEventListener(name, callback) {
  if (this.eventListeners[name]) {
    this.eventListeners[name].splice(this.eventListeners[name].indexOf(callback), 1);
  }
}

export function createElementNode(name, props) {
  const self = new HTMLElement({
    ...props,
    eventListeners: {},
    className: '',
    childNodes: [],
    attributes: {},
    remove,
    dispatchEvent,
    addEventListener,
    removeEventListener,
    replaceWith: replace,
    classList: {
      add(...value) {
        const classes = self.className.trim().split(/\W/);

        self.className = classes.concat(value.filter(x => classes.indexOf(x) === -1)).join(' ');
      },
      remove(...value) {
        self.className = self.className.replace(new RegExp(`(\\b|^)\\s*${value.join('|')}\\s*(\\b|$)`), '').trim();
      },
      replace(oldC, newC) {
        self.className = self.className.replace(new RegExp(`(\\b|^)\\s*${oldC}\\s*(\\b|$)`), ` ${newC} `).trim();
      },
      item(nth) {
        return self.className.split(/[^\w-]/)[nth] || null;
      },
      toggle(value, force) {
        if (force === true) self.classList.add(value);
        else if (force === false) self.classList.remove(value);
        else if (self.classList.contains(value)) self.classList.remove(value);
        else self.classList.add(value);
      },
      contains: value => self.className.split(/\W/).indexOf(value) !== -1,
    },
    get firstChild() {
      return this.childNodes[0];
    },
    get innerHTML() {
      return this.childNodes.map(node => {
        return node.nodeType === 8
          ? `<!--${node.nodeValue}-->`
          : node.outerHTML || node.nodeValue;
      }).join('');
    },
    get outerHTML() {
      const _props = Object.keys(this.attributes).reduce((prev, cur) => {
        prev.push(` ${cur}="${encodeText(this.attributes[cur])}"`);
        return prev;
      }, []);

      if (this.className) {
        _props.push(` class="${this.className}"`);
      }

      if (CLOSE_TAGS.indexOf(name) !== -1) {
        return `<${name}${_props.join('')}>`;
      }

      return `<${name}${_props.join('')}>${this.innerHTML}</${name}>`;
    },
    dispatch(type, params) {
      return tick(() => self.dispatchEvent(new Event(type, params)));
    },
    replaceChild(n, o) {
      mount(n, self);

      self.childNodes.splice(self.childNodes.indexOf(o), 1, n);
    },
    removeChild(n) {
      self.childNodes = self.childNodes.reduce((prev, cur, i) => {
        if (cur !== n) {
          if (prev[i - 1]) prev[i - 1].nextSibling = cur;
          prev.push(cur);
        }
        return prev;
      }, []);
    },
    insertBefore(n, o) {
      mount(n, self);

      if (n instanceof Fragment) {
        n.childNodes.forEach(sub => {
          self.insertBefore(sub, o);
        });
        n.childNodes = [];
      } else {
        self.childNodes.splice(self.childNodes.indexOf(o), 0, n);
      }
    },
    appendChild(n) {
      mount(n, self);

      if (n instanceof Fragment) {
        n.childNodes.forEach(sub => {
          self.appendChild(sub);
        });
        n.childNodes = [];
      } else {
        if (this.childNodes.length) {
          this.childNodes[this.childNodes.length - 1].nextSibling = n;
        }

        if (self.tagName === 'PRE') {
          n.nodeValue = n.nodeValue.replace(/</g, '&lt;').replace(/>/g, '&gt;');
          self.childNodes.push(n);
        } else {
          self.childNodes.push(n);
        }
      }
    },
    getAttribute(k) {
      return !isNot(self.attributes[k])
        ? self.attributes[k]
        : null;
    },
    setAttribute(k, v) {
      self.attributes[k] = v.toString();
    },
    setAttributeNS(ns, k, v) {
      self.attributes[k] = v.toString();
    },
    removeAttribute(k) {
      delete self.attributes[k];
    },
    removeAttributeNS(ns, k) {
      delete self.attributes[k];
    },
  });
  return self;
}

export function createDocumentFragment() {
  return new Fragment();
}

export function createElementNS(ns, name) {
  return createElementNode(name, {
    namespaceURI: ns,
  });
}

export function createElement(name) {
  return createElementNode(name, {
    tagName: name.toUpperCase(),
    nodeType: 1,
  });
}

export function createTextNode(content) {
  return new Text({
    remove,
    replaceWith: replace,
    nodeType: 3,
    nodeValue: String(content),
  });
}

export function createComment(content) {
  return new Comment({
    remove,
    replaceWith: replace,
    nodeType: 8,
    nodeValue: String(content),
  });
}

export function patchDocument() {
  global.document = {
    body: createElement('body'),
    createElementNS,
    createElement,
    createTextNode,
    createComment,
    querySelector() {
      throw new Error('Not implemented');
    },
    createDocumentFragment,
  };
}

export function patchWindow() {
  global.Event = Event;
  global.window = {
    eventListeners: {},
    HTMLElement,
    dispatchEvent,
    addEventListener,
    removeEventListener,
  };
}

export function dropDocument() {
  delete global.document;
}

export function dropWindow() {
  delete global.window;
}
