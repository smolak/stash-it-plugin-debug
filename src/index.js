import { equals, flatten, omit } from 'ramda';

function upperFirst(string) {
    const firstLetter = string[0];
    const restOfTheString = string.substr(1);

    return `${firstLetter.toUpperCase()}${restOfTheString}`;
}

function runPreliminaryCheck({ cacheInstance, key }) {
    if (cacheInstance.hasItem(key)) {
        return Promise.reject(new Error(`You can't run diagnostics on existing item. Use different key.`));
    }

    return Promise.resolve();
}

function runSetItemCheck({ cacheInstance, callback, key, value, extra }) {
    const setItem = cacheInstance.setItem(key, value, extra);

    if (!setItem) {
        return Promise.reject(new Error('Error: Could not set item in the cache.'));
    }

    callback('(1/9) Item set successfully.');

    return Promise.resolve(setItem);
}

function runHasItemCheck({ cacheInstance, callback, key }, setItem) {
    const result = cacheInstance.hasItem(key);

    if (!result) {
        return Promise.reject(new Error('Error: Could not find the item in cache.'));
    }

    callback('(2/9) Item is present in cache.');

    return Promise.resolve(setItem);
}

function runGetItemCheck({ cacheInstance, callback, key }, setItem) {
    const gotItem = cacheInstance.getItem(key);

    if (!gotItem) {
        return Promise.reject(new Error('Error: Item could not be get from cache.'));
    }

    callback('(3/9) Item got from cache successfully.');

    return Promise.resolve({ setItem, gotItem });
}

function runItemComparisonCheck(callback, setItem, gotItem) {
    const result = equals(setItem, gotItem);

    if (!result) {
        const message = 'Error: Retrieved item is different than one created while setting it. If ' +
            'there are any hooks added, they can alter any data being set / got from cache. If you ' +
            'know that there are no hooks that might mutate the data in the process, it means that ' +
            'something is wrong while retrieving data from storage.';

        return Promise.reject(new Error(message));
    }

    callback('(4/9) Items are equal.');

    return Promise.resolve();
}

function runGetExtraCheck({ cacheInstance, callback, key }) {
    const extra = cacheInstance.getExtra(key);

    if (!extra) {
        return Promise.reject(new Error('Error: Extra could not be get from cache.'));
    }

    callback('(5/9) Extra got from cache successfully.');

    return Promise.resolve();
}

function runAddExtraCheck({ cacheInstance, callback, key, extra }) {
    const additionalExtra = { ___someAdditionalExtra___: '___someAdditionalValue___' };
    const customExtra = Object.assign({}, extra, additionalExtra);
    const addedExtra = cacheInstance.addExtra(key, additionalExtra);
    const result = equals(customExtra, addedExtra);

    if (!result) {
        return Promise.reject(new Error('Error: Extra could not be added to cache.'));
    }

    callback('(6/9) Extra added to cache successfully.');

    return Promise.resolve();
}

function runSetExtraCheck({ cacheInstance, callback, key, extra }) {
    const setExtra = cacheInstance.setExtra(key, extra);
    const result = equals(extra, setExtra);

    if (!result) {
        return Promise.reject(new Error('Error: Extra could not be set in cache.'));
    }

    callback('(7/9) Extra set in cache successfully.');

    return Promise.resolve();
}

function runRemoveItemCheck({ cacheInstance, callback, key }) {
    const result = cacheInstance.removeItem(key);

    if (!result) {
        return Promise.reject(new Error('Error: Item could not be removed.'));
    }

    callback('(8/9) Item removed successfully.');

    return Promise.resolve();
}

function runHasItemAfterRemoveCheck({ cacheInstance, callback, key }) {
    const result = cacheInstance.hasItem(key);

    if (result) {
        return Promise.reject(new Error('Error: Item still exists.'));
    }

    callback('(9/9) Item is not present in cache.');

    return Promise.resolve();
}

export default function debug(callback, withCacheInstance = false) {
    if (typeof callback !== 'function') {
        throw new Error('Callback must be a function.');
    }

    const pluggableMethods = [
        'buildKey', 'getItem', 'getExtra', 'addExtra', 'setExtra', 'setItem', 'hasItem', 'removeItem'
    ];
    const prePostPairs = pluggableMethods.map((methodName) => {
        return [
            `pre${upperFirst(methodName)}`,
            `post${upperFirst(methodName)}`
        ];
    });
    const flattenList = flatten(prePostPairs);
    const hooks = flattenList.map((methodName) => {
        return {
            event: methodName,
            handler: (args) => {
                const argsToCall = withCacheInstance ? args : omit([ 'cacheInstance' ], args);

                callback({
                    event: methodName,
                    args: argsToCall
                });

                return args;
            }
        };
    });

    return {
        createExtensions: (cacheInstance) => {
            return {
                runDiagnostics: (key, value, extra) => {
                    const payload = { cacheInstance, callback, key, value, extra };

                    return Promise
                        .resolve(runPreliminaryCheck(payload))
                        .then(() => runSetItemCheck(payload))
                        .then((setItem) => runHasItemCheck(payload, setItem))
                        .then((setItem) => runGetItemCheck(payload, setItem))
                        .then(({ setItem, gotItem }) => runItemComparisonCheck(callback, setItem, gotItem))
                        .then(() => runGetExtraCheck(payload))
                        .then(() => runAddExtraCheck(payload))
                        .then(() => runSetExtraCheck(payload))
                        .then(() => runRemoveItemCheck(payload))
                        .then(() => runHasItemAfterRemoveCheck(payload))
                        .then(() => {
                            callback('Finished: SUCCESS.');
                        })
                        .catch((error) => {
                            // eslint-disable-next-line callback-return
                            callback(error.message);
                            callback('Finished: FAILURE.');
                        });
                }
            };
        },
        hooks
    };
}
