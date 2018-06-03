![logo-stash-it-color-dark 2x](https://user-images.githubusercontent.com/1819138/30385483-99fd209c-98a7-11e7-85e2-595791d8d894.png)

# stash-it-plugin-debug

[![build status](https://img.shields.io/travis/smolak/stash-it-adapter-memory/master.svg?style=flat-square)](https://travis-ci.org/smolak/stash-it-adapter-memory)
[![Coverage Status](https://coveralls.io/repos/github/smolak/stash-it-adapter-memory/badge.svg?branch=master)](https://coveralls.io/github/smolak/stash-it-adapter-memory)

Debug plugin for [stash-it](https://www.npmjs.com/package/stash-it).

This module is best used in development. It helps finding out what is
set in cache and how this data changes (or not) upon any action taken.

It also provides a method to run diagnostics against used storage.
Diagnostics include adding, checking, modifying, removing data in cache
to see if stash-it works with given storage without any problems.

## Installation

```sh
npm install stash-it-plugin-debug --save-dev
```

## Usage

```javascript
import { createCache } from 'stash-it';
import createMemoryAdapter from 'stash-it-adapter-memory'; // you can use any adapter you like
import createDebugPlugin from 'stash-it-plugin-debug';

const adapter = createMemoryAdapter({ namespace: 'someNamespace' });
const cache = createCache(adapter);

// I am using console.log here, but you are free to use any callback /
// logger you want. Checkout API section for more info.
const logger = console.log;
const debugPlugin = createDebugPlugin(logger);
const cacheWithPlugins = cache.registerPlugins([ debugPlugin ]);

// Usage example 1:
cacheWithPlugins.setItem('key', 'value');

// This will log few times informations about cache instance and data flow
// throughout setItem lifecycle, those will be:
// preSetItem, preBuildKey, postBuildKey, postSetItem

// Any other method (getItem, hasItem, removeItem, ...) will produce
// similar logs.

// Usage example 2:
cacheWithPlugins.runDiagnostics('key', 'value', { some: 'extraData' });

// This will log many times as well checking if, for used adapter, all
// base actions work and cache is capable of setting, getting, checking
// for existence and removing things from storage used by adapter.
//
// It's recommended to run this before given storage will be used.
```

## API

### createDebugPlugin(callback, withCacheInstance = false)

Calling this method will return a plugin, ready to use with `stash-it`.

What is a plugin, and how do you write one? Checkout the
[plugins](https://jaceks.gitbooks.io/stash-it/content/advanced-usage/plugins.html)
docs.

#### callback

`callback` needs to be passed as a function. That function will be passed
one argument upon each call. Passed argument will be either and object or a string.

##### For hooks

For hooks, it will be passed objects with data that is passed through stash-it's
lifecycle methods. Object consists of two properties:

 - `event` - that holds the event name, e.g. `preSetItem`
 - `args` - arguments that are passed to that event's handler

Whole object will look like this:

```javascript
{
    event: 'eventName',
    args: { ... }
}
```


For instance. If you use `console.log` as a callback,
for hooks for `setItem` method, you should see something like:

```sh
{ event: 'preSetItem',
  args: { key: 'key', value: 'value', extra: {} } }
{ event: 'preBuildKey', args: { key: 'key' } }
{ event: 'postBuildKey', args: { key: 'namespace.key' } }
{ event: 'postSetItem',
  args:
   { key: 'key',
     value: 'value',
     extra: {},
     item:
      { key: 'namespace.key',
        value: 'value',
        namespace: 'namespace',
        extra: {} } } }
```

As `setItem` uses internally `buildKey` method and all methods have
`pre` and `post` events, that is why you can see logging of `preBuildKey` and `postBuildKey` and data passed to handlers of those events.

See [lifecycle of setItem](https://jaceks.gitbooks.io/stash-it/content/api/cacheinstance.html#setitemkey-value-extra) method for more information.


##### For runDiagnostics

For `runDiagnostics` it will be passed a string with information about
given step runDiagnostics performs. For example, this is how the whole
diagnostics report might look like:

```sh
(1/9) Item set successfully.
(2/9) Item is present in cache.
(3/9) Item got from cache successfully.
(4/9) Items are equal.
(5/9) Extra got from cache successfully.
(6/9) Extra added to cache successfully.
(7/9) Extra set in cache successfully.
(8/9) Item removed successfully.
(9/9) Item is not present in cache.
Finished: SUCCESS.
```

Should any step fail, you will be told so and the last argument to the
callback will be `Funished: FAILURE.`.

#### withCacheInstance = false

By default `cacheInstance` property passed in `args` will not be logged.
That is because it is, in most - if not all - cases, not needed.

If you need to log the `cacheInstance` object simply pass this argument as `true` when creating the plugin.


## Tips and tricks

As the very same callback is used for both `hooks` and `runDiagnostics`,
and as runDiagnostics runs all of the methods, then each method will
produce logging of `{ event, args }` data as well - that could result in a very, very long data log.

Let's say that you only need to check if storage works, but you don't want to see logs for events and their handlers.

For that, you need to pass a more robust callback. Here is one:

```javascript
const callback = (value) => {
    // remember that runDiagnostics passes string to callback
    if (typeof value === 'string') {
        console.log(value);
    }
};
```

And also, the other way around. If you don't want to log `event` and `args`, but only part of that data, you can do it as well. Here's how:

```javascript
const callback = (value) => {
    if (typeof value === 'object') {
        // log whatever you want from either value.event or value.args
    }
};
```
