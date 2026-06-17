/* names.js — Phoneme-based name generator, ~millions of unique names */
'use strict';

const NameGen = (() => {
  const ONSET  = ['r','l','m','n','t','k','s','z','j','v','w','b','d','f','h','sh','kh','th','ry','ly'];
  const VOWEL  = ['a','e','i','o','u','ai','ae','ei','ou','ia','ua','ara','ala'];
  const CODA   = ['','','','','n','m','l','r','k','s','th','sh','nt'];
  const used   = new Set();

  function syllable() {
    const o = ONSET[Math.floor(Math.random() * ONSET.length)];
    const v = VOWEL[Math.floor(Math.random() * VOWEL.length)];
    const c = CODA [Math.floor(Math.random() * CODA.length)];
    return o + v + c;
  }

  function generate() {
    let name, attempts = 0;
    do {
      const n = Math.random() < 0.25 ? 1 : Math.random() < 0.75 ? 2 : 3;
      let raw = '';
      for (let i = 0; i < n; i++) raw += syllable();
      name = raw.charAt(0).toUpperCase() + raw.slice(1);
      attempts++;
    } while (used.has(name) && attempts < 200);
    used.add(name);
    return name;
  }

  return { generate };
})();
