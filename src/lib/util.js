import {
  ELEM_REGEX,
  SKIP_METHODS,
  RE_XML_SPLIT,
  RE_XML_CLOSE_END,
  RE_XML_CLOSE_BEGIN,
} from './shared';

import Fragment from './fragment';

export const isArray = value => Array.isArray(value);
export const isString = value => typeof value === 'string';
export const isFunction = value => typeof value === 'function';
export const isSelector = value => isString(value) && ELEM_REGEX.test(value);
export const isNot = value => typeof value === 'undefined' || value === null;
export const isPlain = value => value !== null && Object.prototype.toString.call(value) === '[object Object]';
export const isObject = value => value !== null && (typeof value === 'function' || typeof value === 'object');
export const isScalar = value => isString(value) || typeof value === 'number' || typeof value === 'boolean';

export const isDiff = (prev, next, isWeak) => {
  if (isWeak && prev === next && (isFunction(prev) || isFunction(next))) return true;
  if (typeof prev !== typeof next) return true;
  if (isArray(prev)) {
    if (prev.length !== next.length) return true;

    for (let i = 0; i < next.length; i += 1) {
      if (isDiff(prev[i], next[i], isWeak)) return true;
    }
  } else if (isPlain(prev) && isPlain(next)) {
    const a = Object.keys(prev).sort();
    const b = Object.keys(next).sort();

    if (isDiff(a, b, isWeak)) return true;

    for (let i = 0; i < a.length; i += 1) {
      if (isDiff(prev[a[i]], next[b[i]], isWeak)) return true;
    }
  } else return prev !== next;
};

export const isEmpty = value => {
  if (isFunction(value)) return false;
  if (isArray(value)) return value.length === 0;
  if (isPlain(value)) return Object.keys(value).length === 0;

  return isNot(value) || value === '' || value === false;
};

export const isNode = x => isArray(x)
  && ((typeof x[0] === 'string' && isSelector(x[0])) || isFunction(x[0]))
  && (x[1] === null || isPlain(x[1]) || isFunction(x[0]));

export const getMethods = obj => {
  const stack = [];

  do {
    stack.push(obj);
  } while (obj = Object.getPrototypeOf(obj)); // eslint-disable-line

  stack.pop();

  return stack.reduce((memo, cur) => {
    const keys = Object.getOwnPropertyNames(cur);

    keys.forEach(key => {
      if (!SKIP_METHODS.includes(key)
        && isFunction(cur[key])
        && !memo.includes(key)
      ) memo.push(key);
    });

    return memo;
  }, []);
};

export const dashCase = value => value.replace(/[A-Z]/g, '-$&').toLowerCase();
export const toArray = value => (!isEmpty(value) && !isArray(value) ? [value] : value) || [];
export const filter = (value, cb) => value.filter(cb || (x => !isEmpty(x)));

export const defer = tasks => {
  return tasks.reduce((prev, [x, fn, ...args]) => prev.then(() => fn(...args)).catch(e => {
    throw new Error(`Failed at ${x}\n${e.stack.replace(/^Error:\s+/, '')}`);
  }), Promise.resolve());
};

export const tree = value => {
  if (isNode(value)) {
    let children = [];
    for (let i = 2; i < value.length; i += 1) {
      children = children.concat(isNode(value[i]) ? [value[i]] : value[i]);
    }
    value.length = 2;
    value.push(children);
  } else if (isArray(value)) {
    return value.map(tree);
  }
  return value;
};

export const flat = value => {
  return !isArray(value) ? tree(value) : value.reduce((memo, n) => memo.concat(isNode(n) ? [tree(n)] : flat(n)), []);
};

export const zip = (prev, next, cb, o = 0, p = []) => {
  const c = Math.max(prev.length, next.length);
  const q = [];

  for (let i = 0; i < c; i += 1) {
    const x = flat(prev[i]);
    const y = flat(next[i]);

    if (!isArray(x) && !isArray(y)) {
      q.push([`Node(${JSON.stringify(x)}, ${JSON.stringify(y)})`, cb, x, y, i + o]);
      continue; // eslint-disable-line
    }

    if (isNode(x)) {
      q.push([`Node(${x[0]})`, cb, tree(x), tree(y), i + o]);
    } else if (isArray(x)) {
      if (isNode(y)) {
        q.push(['Zip', zip, x, [y], cb, i + o, p.concat(y[0])]);
      } else if (isArray(y)) {
        q.push(['Zip', zip, x, y, cb, i + o, p]);
      } else {
        q.push(['Zip', zip, x, [y], cb, i + o, p]);
      }
    } else {
      q.push(['Node', cb, x, y, i + o]);
    }
  }
  return defer(q);
};

export const plain = (target, re) => {
  if (typeof target === 'object' && 'length' in target && !target.nodeType) return Array.from(target).map(x => plain(x, re));
  if (re && target.nodeType === 1) return target.outerHTML;
  if (target.nodeType === 3) return target.nodeValue;
  return Array.from(target.childNodes).map(x => plain(x, true));
};

export const format = markup => {
  let formatted = '';
  let pad = 0;

  markup = markup.replace(RE_XML_SPLIT, '$1\n$2$3');
  markup.split('\n').forEach(line => {
    let indent = 0;
    if (RE_XML_CLOSE_END.test(line)) {
      indent = 0;
    } else if (RE_XML_CLOSE_BEGIN.test(line)) {
      if (pad !== 0) {
        pad -= 1;
      }
    } else {
      indent = 1;
    }

    const padding = Array.from({ length: pad + 1 }).join('  ');

    formatted += `${padding + line}\n`;
    pad += indent;
  });

  return formatted.trim();
};

export const trim = value => {
  const matches = value.match(/\n( )*/);
  const spaces = matches[0].substr(0, matches[0].length - 1);
  const depth = spaces.split('').length;

  return value.replace(new RegExp(`^ {${depth}}`, 'mg'), '').trim();
};

export const clone = value => {
  if (!value || !isObject(value)) return value;
  if (isArray(value)) return value.map(x => clone(x));
  if (value instanceof Date) return new Date(value.getTime());
  if (value instanceof RegExp) return new RegExp(value.source, value.flags);
  return Object.keys(value).reduce((memo, k) => Object.assign(memo, { [k]: clone(value[k]) }), {});
};

export const apply = (cb, length, options = {}) => (...args) => length === args.length && cb(...args, options);
export const raf = cb => ((typeof window !== 'undefined' && window.requestAnimationFrame) || setTimeout)(cb);
export const tick = cb => Promise.resolve().then(cb).then(() => new Promise(done => raf(done)));

export const remove = (target, node) => target && target.removeChild(node);
export const replace = (target, node, i) => target.replaceChild(node, target.childNodes[i]);
export const append = (target, node) => (node instanceof Fragment ? node.mount(target) : target.appendChild(node));

export const detach = (target, node) => {
  if (node) {
    if (node instanceof Fragment) {
      node.mount(target.parentNode, target);
    } else {
      target.parentNode.insertBefore(node, target);
    }
  }
  remove(target.parentNode, target);
};
