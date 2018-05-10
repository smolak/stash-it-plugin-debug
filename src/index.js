import { equals, flatten, omit } from 'ramda';

function upperFirst(string) {
    const firstLetter = string[0];
    const restOfTheString = string.substr(1);

    return `${firstLetter.toUpperCase()}${restOfTheString}`;
}

function runPreliminaryCheck({ cacheInstance, key }) {
    if (cacheInstance.hasItem(key)) {
        throw new Error('You can\'t run diagnostics on existing item. Use different key.');
    }
}

function runSetItemCheck({ cacheInstance, callback, key, value, extra }) {
    const setItem = cacheInstance.setItem(key, value, extra);
    const message = setItem ? '(1/6) Item set successfully.' : 'Error: Could not set item in the cache.';

    callback(message);

    return setItem;
}

function runHasItemCheck({ cacheInstance, callback, key }) {
    const result = cacheInstance.hasItem(key);
    const message = result ? '(2/6) Item is present in cache.' : 'Error: Could not find the item in cache.';

    callback(message);

    return result;
}

function runGetItemCheck({ cacheInstance, callback, key }) {
    const gotItem = cacheInstance.getItem(key);
    const message = gotItem ? '(3/6) Item got from cache successfully.' : 'Error: Item could not be get from cache.';

    callback(message);

    return gotItem;
}

function runItemComparisonCheck(callback, setItem, gotItem) {
    const result = equals(setItem, gotItem);
    const message = result ?
        '(4/6) Items are equal.' :
        'Error: Retrieved item is different than one created while setting it. If ' +
        'there are any hooks added, they can alter any data being set / got from cache. If you ' +
        'know that there are no hooks that might mutate the data in the process, it means that ' +
        'something is wrong while retrieving data from storage.';

    callback(message);

    return result;
}

function runRemoveItemCheck({ cacheInstance, callback, key }) {
    const result = cacheInstance.removeItem(key);
    const message = result ? '(5/6) Item removed successfully.' : 'Error: Item could not be removed.';

    callback(message);

    return result;
}

function runHasItemAfterRemoveCheck({ cacheInstance, callback, key }) {
    const result = cacheInstance.hasItem(key);
    const message = result ? 'Error: Item still exists.' : '(6/6) Item is not present in cache.';

    callback(message);

    return result;
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
                runDiagnostics: (key, value, extra = {}) => {
                    const payload = { cacheInstance, callback, key, value, extra };

                    runPreliminaryCheck(payload);

                    const setItemCheck = runSetItemCheck(payload);

                    if (!setItemCheck) {
                        return;
                    }

                    const hasItemCheck = runHasItemCheck(payload);

                    if (!hasItemCheck) {
                        return;
                    }

                    const getItemCheck = runGetItemCheck(payload);

                    if (!getItemCheck) {
                        return;
                    }

                    const comparisonResult = runItemComparisonCheck(callback, setItemCheck, getItemCheck);

                    if (!comparisonResult) {
                        return;
                    }

                    const removeItemCheck = runRemoveItemCheck(payload);

                    if (!removeItemCheck) {
                        return;
                    }

                    runHasItemAfterRemoveCheck(payload);
                }
            };
        },
        hooks
    };
}
