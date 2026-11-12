/*
 * dc-lite: a tiny template renderer for the Pure Hair Spa site.
 * Supports {{holes}}, <sc-for>, <sc-if>, <dc-import>, on* event holes,
 * ref holes and component classes with renderVals / setState / lifecycle.
 */
(function () {
  'use strict';

  var HOLE = /\{\{\s*([^}]+?)\s*\}\}/g;
  var SINGLE = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/;
  var registry = {};

  function DCLogic(props) {
    this.props = props || {};
    this.state = {};
  }
  DCLogic.prototype.setState = function (patch) {
    if (typeof patch === 'function') patch = patch(this.state, this.props);
    this.state = Object.assign({}, this.state, patch || {});
    if (this.__inst) this.__inst.schedule();
  };
  DCLogic.prototype.forceUpdate = function () {
    if (this.__inst) this.__inst.schedule();
  };
  window.DCLogic = DCLogic;

  function defaultsOf(spec) {
    var d = {};
    Object.keys(spec || {}).forEach(function (k) {
      if (k.charAt(0) === '$') return;
      var s = spec[k];
      if (s && typeof s === 'object' && 'default' in s) d[k] = s.default;
    });
    return d;
  }

  function lookup(scope, path) {
    path = (path || '').trim();
    if (path === 'true') return true;
    if (path === 'false') return false;
    if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
    var parts = path.split('.'), v = scope;
    for (var i = 0; i < parts.length; i++) {
      if (v == null) return undefined;
      v = v[parts[i]];
    }
    return v;
  }
  function single(str) {
    var m = SINGLE.exec(str || '');
    return m ? m[1] : null;
  }
  function interp(str, scope) {
    return str.replace(HOLE, function (_, p) {
      var v = lookup(scope, p);
      return v == null ? '' : String(v);
    });
  }

  function renderNodes(nodes, scope, ctx, out) {
    for (var i = 0; i < nodes.length; i++) renderNode(nodes[i], scope, ctx, out);
    return out;
  }

  function renderNode(n, scope, ctx, out) {
    if (n.nodeType === 3) {
      var t = n.nodeValue;
      out.push(document.createTextNode(t.indexOf('{{') < 0 ? t : interp(t, scope)));
      return;
    }
    if (n.nodeType !== 1) return;
    var tag = n.localName;

    if (tag === 'sc-for') {
      var list = lookup(scope, single(n.getAttribute('list')));
      var as = n.getAttribute('as') || 'item';
      if (list && list.length != null) {
        Array.prototype.forEach.call(list, function (item, idx) {
          var s = Object.create(scope);
          s[as] = item;
          s[as + 'Index'] = idx;
          renderNodes(n.childNodes, s, ctx, out);
        });
      }
      return;
    }
    if (tag === 'sc-if') {
      if (lookup(scope, single(n.getAttribute('value')))) renderNodes(n.childNodes, scope, ctx, out);
      return;
    }
    if (tag === 'dc-import') {
      var name = n.getAttribute('name');
      ctx.hostCount[name] = (ctx.hostCount[name] || 0) + 1;
      var host = document.createElement('div');
      host.setAttribute('data-dc-host', name + '-' + ctx.hostCount[name]);
      host.style.display = 'contents';
      var props = {};
      Array.prototype.forEach.call(n.attributes, function (a) {
        if (a.name === 'name' || /^hint-/.test(a.name)) return;
        var key = a.name.replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); });
        var sv = single(a.value);
        props[key] = a.value.indexOf('{{') < 0 ? a.value : (sv != null ? lookup(scope, sv) : interp(a.value, scope));
      });
      // HTML lowercases attribute names; restore the camelCase props the components read.
      ['focusX', 'focusY', 'rippleSize', 'rippleStrength', 'waterLine', 'glowHeight'].forEach(function (k) {
        var lk = k.toLowerCase();
        if (lk in props && !(k in props)) { props[k] = props[lk]; delete props[lk]; }
      });
      host.__dcImport = { name: name, props: props };
      out.push(host);
      return;
    }

    var el = n.namespaceURI && n.namespaceURI !== 'http://www.w3.org/1999/xhtml'
      ? document.createElementNS(n.namespaceURI, n.localName)
      : document.createElement(tag);
    Array.prototype.forEach.call(n.attributes, function (a) {
      var name = a.name, val = a.value;
      if (/^hint-/.test(name)) return;
      var sv = single(val);
      if (name === 'ref' && sv != null) { el.__dcRef = lookup(scope, sv); return; }
      if (/^on[a-z]+$/.test(name) && sv != null) {
        el.__dcEv = el.__dcEv || {};
        el.__dcEv[name.slice(2)] = lookup(scope, sv);
        return;
      }
      if (val.indexOf('{{') >= 0) {
        if (sv != null) {
          var v = lookup(scope, sv);
          if (v === false || v == null) return;
          val = v === true ? '' : String(v);
        } else {
          val = interp(val, scope);
        }
      }
      if (a.namespaceURI) el.setAttributeNS(a.namespaceURI, name, val);
      else el.setAttribute(name, val);
    });
    var kids = renderNodes(n.childNodes, scope, ctx, []);
    for (var i = 0; i < kids.length; i++) el.appendChild(kids[i]);
    out.push(el);
  }

  function isHost(el) {
    return el.nodeType === 1 && el.hasAttribute('data-dc-host');
  }
  function same(a, b) {
    if (a.nodeType !== b.nodeType) return false;
    if (a.nodeType !== 1) return true;
    if (a.nodeName !== b.nodeName) return false;
    if (isHost(a) || isHost(b)) return a.getAttribute('data-dc-host') === b.getAttribute('data-dc-host');
    return true;
  }
  function patchChildren(parent, newNodes) {
    var old = Array.prototype.slice.call(parent.childNodes), i;
    for (i = 0; i < newNodes.length; i++) {
      var nn = newNodes[i], on = old[i];
      if (!on) { parent.appendChild(nn); continue; }
      if (same(on, nn)) patchNode(on, nn);
      else { parent.replaceChild(nn, on); unmountTree(on); }
    }
    for (; i < old.length; i++) { parent.removeChild(old[i]); unmountTree(old[i]); }
  }
  function patchNode(a, b) {
    if (a.nodeType !== 1) {
      if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue;
      return;
    }
    if (isHost(a)) return;
    Array.prototype.slice.call(a.attributes).forEach(function (at) {
      if (!b.hasAttribute(at.name)) a.removeAttribute(at.name);
    });
    Array.prototype.forEach.call(b.attributes, function (at) {
      if (a.getAttribute(at.name) !== at.value) a.setAttribute(at.name, at.value);
    });
    if ((a.tagName === 'INPUT' || a.tagName === 'TEXTAREA') && b.hasAttribute('value') && a.value !== b.getAttribute('value')) {
      a.value = b.getAttribute('value');
    }
    a.__dcEv = b.__dcEv;
    a.__dcRef = b.__dcRef;
    patchChildren(a, Array.prototype.slice.call(b.childNodes));
  }
  function unmountTree(node) {
    if (node.nodeType !== 1) return;
    if (node.__dcInst) node.__dcInst.unmount();
    var hosts = node.querySelectorAll ? node.querySelectorAll('[data-dc-host]') : [];
    Array.prototype.forEach.call(hosts, function (h) { if (h.__dcInst) h.__dcInst.unmount(); });
  }

  function bindEvents(el) {
    if (!el.__dcEv) return;
    el.__dcBound = el.__dcBound || {};
    Object.keys(el.__dcEv).forEach(function (type) {
      if (el.__dcBound[type]) return;
      el.__dcBound[type] = true;
      el.addEventListener(type, function (e) {
        var f = el.__dcEv && el.__dcEv[type];
        if (typeof f === 'function') f(e);
      });
    });
  }
  function postWalk(root) {
    var kids = root.children;
    for (var i = 0; i < kids.length; i++) {
      var el = kids[i];
      bindEvents(el);
      if (typeof el.__dcRef === 'function') el.__dcRef(el);
      if (isHost(el)) {
        if (!el.__dcInst && el.__dcImport) {
          var inst = new Instance(el.__dcImport.name, el.__dcImport.props, el);
          inst.mount();
        }
        continue;
      }
      postWalk(el);
    }
  }

  function Instance(name, props, host) {
    var R = registry[name];
    if (!R) throw new Error('dc-lite: unknown component ' + name);
    this.R = R;
    this.host = host;
    this.pending = false;
    this.alive = true;
    this.comp = new R.Cls(Object.assign({}, R.defaults, props || {}));
    this.comp.__inst = this;
    host.__dcInst = this;
  }
  Instance.prototype.render = function () {
    if (!this.alive) return;
    var vals = this.comp.renderVals ? this.comp.renderVals() || {} : {};
    var nodes = renderNodes(this.R.tpl.content.childNodes, vals, { hostCount: {} }, []);
    patchChildren(this.host, nodes);
    postWalk(this.host);
  };
  Instance.prototype.schedule = function () {
    if (this.pending || !this.alive) return;
    this.pending = true;
    var self = this;
    Promise.resolve().then(function () { self.pending = false; self.render(); });
  };
  Instance.prototype.mount = function () {
    this.render();
    if (this.comp.componentDidMount) this.comp.componentDidMount();
  };
  Instance.prototype.unmount = function () {
    if (!this.alive) return;
    this.alive = false;
    if (this.comp.componentWillUnmount) this.comp.componentWillUnmount();
  };

  window.DC = {
    define: function (name, tpl, Cls, spec) {
      registry[name] = { tpl: tpl, Cls: Cls, defaults: defaultsOf(spec) };
    },
    mount: function (name, host) {
      var inst = new Instance(name, {}, host);
      inst.mount();
      return inst;
    }
  };
})();
