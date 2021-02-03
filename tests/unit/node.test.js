/* eslint-disable no-unused-expressions */

import td from 'testdouble';
import { expect } from 'chai';

import {
  createElement, mountElement, destroyElement, updateElement,
} from '../../src/lib/node';

import Fragment from '../../src/lib/fragment';

import { tick, trim, format } from '../../src/lib/util';
import { fixTree } from '../../src/lib/attrs';

import doc from './fixtures/document';

/* global beforeEach, afterEach, describe, it */

describe('node', () => {
  beforeEach(doc.enable);
  afterEach(doc.disable);

  describe('DocumentFragment', () => {
    it('should return children nodes after mount', () => {
      const tmp = createElement([['foo', ['b', null, ['bar']]]]);
      expect(tmp.children).to.eql([]);

      tmp.mount(document.body);
      expect(tmp.children).to.eql([
        tmp.getNodeAt(0),
      ]);
    });

    it('should flatten arrays as fragments', () => {
      const tree = createElement([
        ['span', ['foo']],
        ['span', ['bar']],
      ]);

      const div = document.createElement('div');
      div.appendChild(tree);

      expect(div.childNodes.some(x => x instanceof Fragment)).to.be.false;
      expect(div.outerHTML).to.eql('<div><span>foo</span><span>bar</span></div>');
    });

    it('should invoke factories from fragments', () => {
      const value = 42;
      const children = [function Random() {
        return ['OK: ', -1];
      }];

      expect(createElement([
        ['p', [
          ['span', ['value: ', value]],
        ]],
        children,
      ]).outerHTML).to.eql('<p><span>value: 42</span></p>OK: -1');
    });

    it('should render children indistinctly', () => {
      expect(createElement(['p', null, 'hola', 'mundo']).outerHTML).to.eql('<p>holamundo</p>');
      expect(createElement(['p', null, 'hola', 'mundo']).childNodes.length).to.eql(2);

      expect(createElement(['p', null, ['hola', 'mundo']]).outerHTML).to.eql('<p>holamundo</p>');
      expect(createElement(['p', null, ['hola', 'mundo']]).childNodes.length).to.eql(2);

      expect(createElement(['p', null, [['hola', 'mundo']]]).outerHTML).to.eql('<p>holamundo</p>');
      expect(createElement(['p', null, [['hola', 'mundo']]]).childNodes.length).to.eql(3);
    });

    describe('updateElement', () => {
      let div;
      let x;
      let y;

      const factory = (...children) => ({
        vnode: fixTree([
          ['span', ['OK']],
          ...children,
        ]),
        result: `<div><span>OK</span>${children.reduce((memo, it) => memo.concat(it), []).join('')}</div>`,
      });

      beforeEach(() => {
        div = document.createElement('div');
      });

      it('should allow to patch unmounted fragments', () => {
        const a = createElement(['a', 'b', 'c']);

        expect(a.outerHTML).to.eql('abc');
        updateElement(a, ['a', 'b', 'c'], ['d', 'e', 'f']);
        expect(a.outerHTML).to.eql('def');
      });

      it('should skip anchors while patching fragments', () => {
        x = factory('just: ', 'x');
        y = factory('just: ', 'y');

        const el = mountElement(div, x.vnode);
        expect(div.outerHTML).to.eql(x.result);
        expect(div.childNodes.length).to.eql(3);
        expect(div.firstChild._anchored).to.eql(el);
        expect(x.result).to.contains(el.outerHTML);

        updateElement(div, x.vnode, y.vnode);
        expect(div.childNodes.length).to.eql(3);
        expect(div.outerHTML).to.eql(y.result);
      });

      it('should skip anchors while patching fragments (mixed)', () => {
        x = factory('just: ', 'x');
        y = factory(['just: ', 'y']);

        mountElement(div, x.vnode);
        expect(div.outerHTML).to.eql(x.result);

        updateElement(div, x.vnode, y.vnode);
        expect(div.outerHTML).to.eql(y.result);
      });

      it('should skip anchors while patching fragments (nested)', () => {
        x = factory(['just: ', 'x']);
        y = factory(['just: ', 'y']);

        mountElement(div, x.vnode);
        expect(div.outerHTML).to.eql(x.result);

        updateElement(div, x.vnode, y.vnode);
        expect(div.outerHTML).to.eql(y.result);
      });

      it('should flatten all nested Fragments into a single one', () => {
        const vdom = value => fixTree([
          ['small', null, ['TEXT']],
          ['\n', '\n\n\n  PATH=/:id/edit\n  ', ['\n  ', value, ':\n'], '\n\n'],
          ['\n', '\n\n\n'],
        ]);

        const a = vdom('BEFORE');
        const b = vdom('AFTER');

        div = document.body;
        mountElement(div, a);
        expect(div.childNodes.length).to.eql(3);
        expect(div.childNodes.filter(n => !n._anchored).length).to.eql(2);

        updateElement(div, a, b);
        expect(div.childNodes.length).to.eql(3);
        expect(div.childNodes.filter(n => !n._anchored).length).to.eql(2);
      });

      it('should trigger onupdate/update methods on fragments', async () => {
        const callback = td.func('update');

        let ref;
        function Test(props, children) {
          ref = createElement(children);
          ref.onupdate = callback;
          ref.update = callback;
          return ref;
        }

        let old;
        const el = mountElement(document.body, old = [
          ['div', null, [
            [Test, { foo: 'bar' }, ['baz']],
          ]],
        ]);

        expect(el.outerHTML).to.eql('<div>baz</div>');
        expect(td.explain(callback).callCount).to.eql(0);

        updateElement(document.body, old, old = [
          ['div', null, [
            [Test, { baz: 'buzz' }, ['bazzinga']],
          ]],
        ]);

        await tick();

        expect(el.outerHTML).to.eql('<div>bazzinga</div>');
        expect(td.explain(callback).callCount).to.eql(2);

        updateElement(ref, [Test, { baz: 'buzz' }, ['bazzinga']], [Test, { key: 'x' }, ['yz']]);

        expect(el.outerHTML).to.eql('<div>yz</div>');
        expect(td.explain(callback).callCount).to.eql(4);
      });
    });

    it('should apply fragment patching on update', async () => {
      let ref;
      function Test(props, children) {
        ref = createElement(children);
        return ref;
      }

      let old;
      const el = mountElement(document.body, old = [
        ['ul', null, [
          ['li', null, ['Test 0']],
          [Test, { key: 'x' }, [
            ['li', null, ['Test 1']],
            ['li', null, ['Test 2']],
          ]],
          ['li', null, ['Test N']],
        ]],
      ]);

      expect(el.outerHTML).to.eql('<ul><li>Test 0</li><li>Test 1</li><li>Test 2</li><li>Test N</li></ul>');
      expect(el.nodeType).to.eql(11);

      updateElement(document.body, old, old = [
        ['ul', null, [
          ['li', null, ['Test 3']],
          [Test, { key: 'x' }, [
            ['li', null, ['Test 4']],
          ]],
          ['li', null, ['Test M']],
        ]],
      ]);

      await tick();

      expect(el.outerHTML).to.eql('<ul><li>Test 3</li><li>Test 4</li><li>Test M</li></ul>');
      expect(el.nodeType).to.eql(11);

      updateElement(ref, [Test, { key: 'x' }, [
        ['li', null, ['Test 4']],
      ]], [Test, { key: 'x' }, [
        ['li', null, ['Test 8']],
        ['li', null, ['Test 9']],
      ]]);

      expect(el.outerHTML).to.eql('<ul><li>Test 3</li><li>Test 8</li><li>Test 9</li><li>Test M</li></ul>');
    });
  });

  describe('destroyElement', () => {
    let parent;
    let div;

    beforeEach(() => {
      parent = document.createElement('root');
      div = document.createElement('div');

      div.remove = td.func('remove');
      parent.appendChild(div);
    });

    it('should invoke node.remove() method from given node', async () => {
      await destroyElement(div);
      expect(td.explain(div.remove).callCount).to.eql(1);
    });

    it('should skip removal if wait() does not resolve', async () => {
      await destroyElement(div, () => null);
      expect(td.explain(div.remove).callCount).to.eql(0);
    });

    it('should remove all Fragment childNodes', async () => {
      const vdom = createElement([[['OSOM'], ['SO']]]);
      const remove = td.func('-OSOM');
      const remove2 = td.func('-SO');

      vdom.mount(document.createElement('div'));

      td.replace(vdom.getNodeAt(0), 'remove', remove);
      td.replace(vdom.getNodeAt(1), 'remove', remove2);

      await vdom.remove();

      expect(td.explain(remove).callCount).to.eql(1);
      expect(td.explain(remove2).callCount).to.eql(1);
    });
  });

  describe('createElement', () => {
    it('should fail on invalid input', () => {
      expect(createElement).to.throw(/Invalid vnode/);
    });

    it('should return scalar values as text', () => {
      expect(createElement('Just text').nodeValue).to.eql('Just text');
    });

    it('should handle regular html-elements', () => {
      expect(createElement(['span', null]).tagName).to.eql('SPAN');
    });

    it('should handle svg-elements too', () => {
      expect(createElement(['svg', null]).isSvg).to.be.true;
    });

    it('should call factories recursively', () => {
      let count = null;

      function Tag(props, children) {
        if (count === null) {
          count = props.count;
          return [Tag, props, children];
        }

        if (count > 3) {
          return ['stop', props, children];
        }

        count += 1;

        return [Tag, { ...props, count }, children];
      }

      const target = createElement([Tag, { count: 0 }, 42]);

      expect(target.outerHTML).to.eql('<stop count="3">42</stop>');
    });

    it('should handle children as 2nd argument', () => {
      expect(createElement(['span', [1, 'foo']]).childNodes.map(x => x.nodeValue)).to.eql(['1', 'foo']);
      expect(createElement(['span', ['TEXT']]).childNodes.map(x => x.nodeValue)).to.eql(['TEXT']);
      expect(createElement(['span', [12.3]]).childNodes.map(x => x.nodeValue)).to.eql(['12.3']);
      expect(createElement(['span', [false]]).childNodes).to.eql([]);
    });

    it('should wrap trees as DocumentFragment nodes', () => {
      const tree = [[[[['p', [[[[['i', null]]]]]]]]]];
      const node = createElement(tree);
      node.mount(document.createElement('div'));

      expect(node.parentNode).not.to.be.undefined;
      expect(node.childNodes.length).to.eql(0);
      expect(node.outerHTML).to.eql('<p><i></i></p>');
      expect(node.getNodeAt(0).tagName).to.eql('P');
      expect(node.getNodeAt(0).childNodes.length).to.eql(2);
      expect(node.getNodeAt(0).childNodes[0].nodeType).to.eql(3);
      expect(node.getNodeAt(0).childNodes[1].tagName).to.eql('I');
      expect(node.getNodeAt(0).childNodes[1].childNodes.length).to.eql(0);
    });

    it('should pass created element to given callback', () => {
      const spy = td.func('callback');

      createElement(['span', null], null, spy);
      expect(td.explain(spy).callCount).to.eql(1);
    });

    it('should handle functions as elements', () => {
      const attrs = {};
      const nodes = [];

      const Spy = td.func('Component');

      td.when(Spy(attrs, nodes)).thenReturn(['div', null]);

      expect(createElement([Spy, attrs, nodes]).tagName).to.eql('DIV');
    });

    it('should pass given attributes to assignProps()', () => {
      expect(createElement(['code', { foo: 'bar' }]).attributes).to.eql({ foo: 'bar' });
    });

    it('should append given nodes as childNodes', () => {
      const node = createElement(['ul', [
        ['li', ['1']],
        ['li', ['2']],
      ]]);

      expect([node.tagName, node.childNodes.map(x => [x.tagName, x.childNodes.map(y => y.nodeValue)])]).to.eql([
        'UL', [
          ['LI', ['1']],
          ['LI', ['2']],
        ],
      ]);
    });

    it('should invoke returned functions from hooks', () => {
      const fn = td.func('hook');

      td.when(fn())
        .thenReturn(['div', null]);

      td.when(fn(td.matchers.isA(Object), 'span', null, []))
        .thenReturn(fn);

      const node = createElement(['span', null], null, fn);

      expect(td.explain(fn).callCount).to.eql(3);
      expect(node.outerHTML).to.eql('<div></div>');
    });

    it('should invoke events/hooks', async () => {
      const div = document.createElement('div');

      div.oncreate = td.func('oncreate');
      div.ondestroy = td.func('ondestroy');
      div.teardown = td.func('teardown');
      div.enter = td.func('enter');
      div.exit = td.func('exit');

      createElement(['x', null], null, () => div);

      expect(td.explain(div.oncreate).callCount).to.eql(1);
      expect(td.explain(div.enter).callCount).to.eql(1);

      await div.remove();

      expect(td.explain(div.ondestroy).callCount).to.eql(1);
      expect(td.explain(div.teardown).callCount).to.eql(1);
      expect(td.explain(div.exit).callCount).to.eql(1);
    });

    it('should append non-empty values only', () => {
      expect(createElement(['div', [null, false, 0]]).outerHTML).to.eql('<div>0</div>');
    });
  });

  describe('mountElement', () => {
    const h = createElement;

    function ok(target) {
      expect(target.childNodes.length).to.eql(1);
      expect(target.childNodes[0].tagName).to.eql('SPAN');
    }

    it('returns nothing if nothing is given', () => {
      expect(mountElement()).to.be.undefined;
    });

    it('should help to mount given vnodes', () => {
      const div = document.createElement('div');

      mountElement(div, ['span', null], h);
      ok(div);
    });

    it('should mount given html-elements', () => {
      const div = document.createElement('div');
      const span = document.createElement('span');

      mountElement(div, span);
      ok(div);
    });

    it('should use document.body if target is not given', () => {
      mountElement(['span', null], h);
      ok(document.body);
    });

    it('should fallback to view if arity is 1', () => {
      mountElement(['span', null]);
      ok(document.body);
    });

    it('should call querySelector() if target is an string', () => {
      td.replace(document, 'querySelector');
      td.when(document.querySelector('body'))
        .thenReturn(document.body);

      mountElement('body', ['span', null]);
      ok(document.body);

      td.reset();
    });

    it('should create markup from scalar values', () => {
      mountElement(null, 42);
      expect(document.body.innerHTML).to.eql('42');
    });

    it('should create fragments from arrays', () => {
      mountElement(null, [42, ['i', [-1]]]);
      expect(document.body.innerHTML).to.eql('42<i>-1</i>');
    });

    it('should mount fragments recursively', () => {
      const div = document.createElement('div');

      mountElement(div, [
        'Some text ',
        ['strong', ['before HTML']],
        ': ',
        [
          'because',
          ' ',
          ['em', ['it is']],
          [' ', [['strong', ['possible!']]]],
        ],
      ]);

      expect(format(div.outerHTML)).to.eql(trim(`
        <div>Some text <strong>before HTML</strong>: because <em>it is</em> <strong>possible!</strong>
        </div>
      `));
    });

    it('should fail on invalid targets', () => {
      expect(() => mountElement('#undef', [])).to.throw(/Target '#undef' not found/);
    });
  });

  describe('updateElement', () => {
    let body;
    let div;
    let a;

    beforeEach(() => {
      body = document.createElement('body');
      div = document.createElement('div');
      a = document.createElement('a');

      body.appendChild(div);
      div.appendChild(a);

      expect(a.outerHTML).to.eql('<a></a>');
    });

    it('should skip _dirty nodes', () => {
      div._dirty = true;
      updateElement(div, ['div', null], ['b', null, 'OK!']);
      expect(body.innerHTML).to.eql('<div><a></a></div>');
    });

    it('can reconcilliate childNodes', () => {
      updateElement(div, ['div', null], ['b', null, 'OK!']);
      expect(body.innerHTML).to.eql('<b>OK!</b>');

      updateElement(div, ['b', null, 'OK!'], [['b', null, 'NOT']]);
      expect(body.innerHTML).to.eql('<b>NOT</b>');
    });

    it('can reconcilliate root nodes', () => {
      updateElement(div, ['div', null], ['b', null, 'OK']);
      expect(body.innerHTML).to.eql('<b>OK</b>');

      updateElement(div, ['b', null, 'OK'], [['b', null, 'OK']]);
      expect(body.innerHTML).to.eql('<b>OK</b>');

      updateElement(div, [['b', null, 'OK']], [[[['b', null, 'OK']]]]);
      expect(body.innerHTML).to.eql('<b>OK</b>');

      updateElement(div, [[[['b', null, 'OK']]]], 'bar');
      expect(body.innerHTML).to.eql('bar');
    });

    it('can reconcilliate text nodes', () => {
      updateElement(div, ['div', null], [['foo bar']]);
      expect(body.innerHTML).to.eql('foo bar');

      updateElement(div, [['foo bar']], [['some text', [[['b', null, 'OK']]]]]);
      expect(div.innerHTML).to.eql('some text<b>OK</b>');

      updateElement(div, [['some text', ['b', null, 'OK']]], ['foo ', 'barX']);
      expect(div.innerHTML).to.eql('foo barX');

      updateElement(div, ['foo ', 'barX'], ['a ', 'OK']);
      expect(div.innerHTML).to.eql('a OK');

      updateElement(div, ['a ', 'OK'], ['a', null, 'OK']);
      expect(div.innerHTML).to.eql('aOKOK');
    });

    it('can reconcilliate between both text/nodes', () => {
      updateElement(div, 'OLD', ['b', null, 'NEW']);
      expect(body.outerHTML).to.eql('<body><b>NEW</b></body>');

      updateElement(div, ['a', null], 'FIXME');
      expect(body.outerHTML).to.eql('<body>FIXME</body>');
    });

    it('can update nodes if they are the same', () => {
      updateElement(div, ['div', null], ['div', null, 'NEW']);
      expect(body.outerHTML).to.eql('<body><div>NEW</div></body>');
    });

    it('can replace nodes if they are different', () => {
      updateElement(div, ['div', null], ['b', null, 'NEW']);
      expect(body.outerHTML).to.eql('<body><b>NEW</b></body>');
    });

    it('can patch node attributes', () => {
      updateElement(a, ['a', []], ['a', { href: '#' }]);
      expect(a.outerHTML).to.eql('<a href="#"></a>');
    });

    it('can update scalar values', () => {
      updateElement(div, ['div', null, 1], ['div', null, 0]);
      expect(body.innerHTML).to.eql('<div>0</div>');
    });

    it('will invoke hooks on update', () => {
      a.onupdate = td.func('onupdate');
      a.update = td.func('update');

      updateElement(a, ['a', null], ['a', { href: '#' }]);

      expect(td.explain(a.onupdate).callCount).to.eql(1);
      expect(td.explain(a.update).callCount).to.eql(1);
    });

    it('can append childNodes', () => {
      updateElement(a, ['a', null], ['a', [[[['c', null, 'd']]]]]);
      expect(div.outerHTML).to.eql('<div><a><c>d</c></a></div>');
    });

    it('can remove childNodes', async () => {
      a.appendChild(createElement(['b', null]));

      updateElement(a, ['a', [[[['b', null]]]]], ['a', null]);
      await tick();

      expect(div.outerHTML).to.eql('<div><a></a></div>');
    });

    it('can update TextNodes', () => {
      a.appendChild(document.createTextNode());
      updateElement(a, ['a', ['old']], ['a', ['old']]);
      updateElement(a, ['a', ['old']], ['a', ['new']]);
      expect(div.outerHTML).to.eql('<div><a>new</a></div>');
    });

    it('will iterate recursively', () => {
      a.appendChild(createElement(['b', null]));
      updateElement(a, ['a', [['b', null]]], ['a', [[[[['b', null]]]]]]);
      expect(a.outerHTML).to.eql('<a><b></b></a>');
    });

    it('will append given children', () => {
      updateElement(a, ['a', null], ['a', [['b', null]]]);
      updateElement(a, ['a', [['b', null]]], ['a', [[['i', null], [[[['i', null]]]], [[[[['i', null]]]]]]]]);
      expect(a.outerHTML).to.eql('<a><i></i><i></i><i></i></a>');
    });

    it('patch over function values', () => {
      const Em = Array.prototype.concat.bind(['em']);

      function Del(props, children) {
        return ['del', [[Em, props, children]]];
      }

      const $old = [[[Del, 'OK']]];
      const $new = [[[[[Del, [[['OSOM!']]]]]]]];

      a.appendChild(createElement($old));
      updateElement(a, $old, $new);

      expect(a.innerHTML).to.eql('<del><em>OSOM!</em></del>');
      expect(div.innerHTML).to.eql('<a><del><em>OSOM!</em></del></a>');
      expect(body.innerHTML).to.eql('<div><a><del><em>OSOM!</em></del></a></div>');
    });

    it('should skip over invalid childNodes', () => {
      a.appendChild(document.createComment('OK'));
      a.appendChild(document.createTextNode(''));
      a.appendChild(document.createElement('b'));
      updateElement(a, ['a', [['b', null]]], ['a', [['b', [42]]]]);
      expect(a.outerHTML).to.eql('<a><!--OK--><b>42</b></a>');
    });
  });
});
