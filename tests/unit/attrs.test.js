/* eslint-disable no-unused-expressions */

import td from 'testdouble';
import { expect } from 'chai';

import {
  assignProps, updateProps, fixProps, fixTree,
} from '../../src/lib/attrs';

import doc from './fixtures/document';

/* global beforeEach, afterEach, describe, it */

describe('attrs', () => {
  beforeEach(doc.enable);
  afterEach(doc.disable);

  describe('fixTree', () => {
    it('should flatten values from nested trees', () => {
      expect(fixTree([[[1, 2, 3]]])).to.eql([1, 2, 3]);
      expect(fixTree([[[1, [2], 3]]])).to.eql([1, 2, 3]);
      expect(fixTree([[[1, [2], [[3]]]]])).to.eql([1, 2, 3]);
    });

    it('will invoke tag functions recursively', () => {
      const tree = [() => [() => ['span', null, 'O', [[() => ['em', null, 'k']], '!']]]];

      expect(fixTree(tree)).to.eql(['span', null, 'O', [['em', null, 'k'], '!']]);
    });

    it('should unflatten nested children', () => {
      const tree = [[[['span', null, 'O', [[['em', null, 'k']], '!']]]]];

      expect(fixTree(tree)).to.eql([['span', null, 'O', [['em', null, 'k'], '!']]]);
    });
  });

  describe('fixProps', () => {
    it('should fail on invalid or missing input', () => {
      expect(fixProps).not.to.throw();
      expect(() => fixProps([])).not.to.throw();
      expect(() => fixProps([''])).not.to.throw();
    });

    it('should normalize given vnodes', () => {
      expect(fixProps(['grab'])).to.eql(['grab']);
      expect(fixProps(['grab', 'a', 'beer'])).to.eql(['grab', 'a', 'beer']);
      expect(fixProps(['grab', ['a', 'beer']])).to.eql(['grab', null, 'a', 'beer']);
      expect(fixProps(['grab', ['a', ['beer']]])).to.eql(['grab', null, 'a', ['beer']]);
      expect(fixProps(['grab', ['a', ['beer']]], 1)).to.eql(['grab', null, ['a', null, 'beer']]);
    });

    it('should fix emmet-like syntax tagName', () => {
      expect(fixProps(['#a', null])).to.eql(['div', { id: 'a' }]);
      expect(fixProps(['div#a', null])).to.eql(['div', { id: 'a' }]);
      expect(fixProps(['div.b.c', null])).to.eql(['div', { class: ['b', 'c'] }]);
      expect(fixProps(['div#a.b.c', null])).to.eql(['div', { id: 'a', class: ['b', 'c'] }]);
    });

    it('should merge given classes with static ones', () => {
      expect(fixProps(['div#a.b.c', { class: undefined }])).to.eql(['div', { id: 'a', class: ['b', 'c'] }]);
      expect(fixProps(['div#a.b.c', { class: 'd' }])).to.eql(['div', { id: 'a', class: ['b', 'c', 'd'] }]);
      expect(fixProps(['div#a.b.c', { class: ['c', 'd'] }])).to.eql(['div', { id: 'a', class: ['b', 'c', 'd'] }]);
      expect(fixProps(['div#a.b.c', { class: { d: 1 } }])).to.eql(['div', { id: 'a', class: { b: 1, c: 1, d: 1 } }]);
    });
  });

  describe('assignProps', () => {
    let div;

    beforeEach(() => {
      div = document.createElement('div');
    });

    it('should append given attributes', () => {
      assignProps(div, { foo: 'bar' });
      expect(div.attributes).to.eql({ foo: 'bar' });
    });

    it('should skip special attributes, like key', () => {
      assignProps(div, { key: 'bar' });
      expect(div.attributes).to.eql({});
    });

    it('should pass special attributes to given callback', () => {
      const spy = td.func('callback');

      assignProps(div, { baz: ['buzz'] }, null, spy);
      expect(td.explain(spy).callCount).to.eql(1);
    });

    it('should handle boolean attributes as expected', () => {
      assignProps(div, { test: true });
      expect(div.attributes).to.eql({ test: 'test' });
    });

    it('should handle attributes from svg-elements too', () => {
      const svg = document.createElementNS('xmlns', 'svg');

      assignProps(svg, { 'xlink:href': 'z' }, true);
      expect(svg.attributes).to.eql({ href: 'z' });
    });

    it('should remove attributes on falsy values', () => {
      div.attributes = { foo: 'bar', href: 'baz' };

      assignProps(div, {
        foo: false,
        'xlink:href': null,
        notFalsy: 0,
        emptyValue: '',
      }, true);

      expect(div.attributes).to.eql({ notFalsy: 0 });
    });
  });

  describe('updateProps', () => {
    it('should update changed values only', () => {
      const div = document.createElement('div');

      div.attributes = { a: 'b', foo: 'bar', href: 'baz' };

      updateProps(div, div.attributes, { foo: 'BAR', a: 'b' });
      expect(div.attributes).to.eql({ foo: 'BAR', a: 'b' });
    });
  });
});
