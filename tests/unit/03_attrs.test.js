/* eslint-disable no-unused-expressions */

import td from 'testdouble';
import { expect } from 'chai';

import {
  assignProps, updateProps, fixProps,
} from '../../src/lib/attrs';

import doc from '../../src/ssr/jsdom';

/* global beforeEach, afterEach, describe, it */

describe('attrs', () => {
  beforeEach(doc.enable);
  afterEach(doc.disable);

  let div;
  beforeEach(() => {
    div = document.createElement('div');
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
      expect(fixProps(['grab', ['a', 'beer']])).to.eql(['grab', null, ['a', 'beer']]);
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
    it('should append given attributes', () => {
      assignProps(div, { foo: 'bar' });
      expect(div.getAttribute('foo')).to.eql('bar');
    });

    it('should skip special attributes, like key', () => {
      assignProps(div, { key: 'bar' });
      expect(div.getAttribute('key')).to.be.null;
    });

    it('should pass special attributes to given callback', () => {
      const spy = td.func('callback');

      assignProps(div, { baz: ['buzz'] }, null, spy);
      expect(td.explain(spy).callCount).to.eql(1);
    });

    it('should handle boolean attributes as expected', () => {
      assignProps(div, { test: true });
      expect(div.getAttribute('test')).to.eql('test');
    });

    it('should handle attributes from svg-elements too', () => {
      const svg = document.createElementNS('xmlns', 'svg');

      assignProps(svg, { 'xlink:href': 'z' }, true);
      expect(svg.getAttribute('href')).to.eql('z');
    });

    it('should remove attributes on falsy values', () => {
      div.setAttribute('foo', 'bar');
      div.setAttribute('hrez', 'baz');

      assignProps(div, {
        foo: false,
        'xlink:href': null,
        notFalsy: 0,
        emptyValue: '',
      }, true);

      expect(div.getAttribute('foo')).to.eql(null);
      expect(div.getAttribute('href')).to.eql(null);
      expect(div.getAttribute('notFalsy')).to.eql('0');
      expect(div.getAttribute('emptyValue')).to.eql(null);
    });
  });

  describe('updateProps', () => {
    it('should update changed values only', () => {
      div.setAttribute('a', 'b');
      div.setAttribute('foo', 'bar');
      div.setAttribute('href', 'baz');

      updateProps(div, div.attributes, { foo: 'BAR', a: 'b' });
      expect(div.getAttribute('foo')).to.eql('BAR');
      expect(div.getAttribute('a')).to.eql('b');
    });
  });
});
