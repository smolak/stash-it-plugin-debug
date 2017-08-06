<table>
  <thead>
    <tr>
      <th><strong>Home</strong></th>
      <th><a href="https://smolak.github.io/stash-it-plugin-debug/docs.html">Docs</a></th>
    </tr>
  </thead>
</table>

# Installation

```
npm install stash-it-plugin-debug --save-dev
```

## What is it used for?

This module is best used in development.
It helps finding out what is set in cache and how this data change (or not) upon any action taken.

## How to use it?

```javascript
import { createCache, registerPlugins } from 'stash-it';
import createMemoryAdapter from 'stash-it-adapter-memory'; // you can use any adapter you like
import createDebugPlugin from 'stash-it-plugin-debug';

const adapter = createMemoryAdapter({ namespace: 'someNamespace' });
const cache = createCache(adapter);

// I am using console.log here, but you are free to use any callback / logger you want.
// See `Docs` section for more info
const logger = console.log;
const debugPlugin = createDebugPlugin(logger);
const cacheWithPlugins = registerPlugins(cache, [ debugPlugin ]);

// Usage example 1:
cacheWithPlugins.setItem('key', 'value');

// This will log few times info about cache instance and data throughout setItem lifecycle,
// those will be: preSetItem, preBuildKey, postBuildKey, postSetItem

// Usage example 2:
cacheWithPlugins.runDiagnostics('key', 'value');

// This will log few times as well checking if, for used adapter, all base actions work
// and cache is capable of setting, getting, checking for existence and removing things
// from storage used by adapter.
//
// It's recommended to run this before given storage will be used.
```
