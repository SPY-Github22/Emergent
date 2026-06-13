/* events.js — Global event bus */
'use strict';

const events = (() => {
  const _listeners = {};
  return {
    on(evt, fn)   { (_listeners[evt] = _listeners[evt] || []).push(fn); },
    off(evt, fn)  { if (_listeners[evt]) _listeners[evt] = _listeners[evt].filter(f => f !== fn); },
    emit(evt, d)  { (_listeners[evt] || []).forEach(fn => fn(d)); },
    once(evt, fn) {
      const wrap = (d) => { fn(d); this.off(evt, wrap); };
      this.on(evt, wrap);
    }
  };
})();
