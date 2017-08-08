import { equals, flatten, omit } from 'ramda';

function upperFirst(string) {
    const firstLetter = string[0];
    const restOfTheString = string.substr(1);

    return `${firstLetter.toUpperCase()}${restOfTheString}`;
}

export default function debug(callback, withCacheInstance = false) {
    if (typeof callback !== 'function') {
        throw new Error('Callback must be a function.');
    }

    const pluggableMethods = [ 'buildKey', 'getItem', 'getExtra', 'setItem', 'hasItem', 'removeItem' ];
    const prePostPairs = pluggableMethods.map((methodName) => {
        return [
            `pre${upperFirst(methodName)}`,
            `post${upperFirst(methodName)}`
        ]
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
        }
    });

    return {
        getExtensions: (cacheInstance) => {
            return {
                runDiagnostics: (key, value, extra = {}) => {
                    const result1 = cacheInstance.hasItem(key);

                    if (result1) {
                        throw new Error('You can\'t run diagnostics on existing item. Use different key.');
                    }

                    const setItem = cacheInstance.setItem(key, value, extra);

                    callback('(1/6) Item set successfully.');

                    const result2 = cacheInstance.hasItem(key);

                    if (!result2) {
                        callback('Error: Could not find the item in cache.');

                        return;
                    }

                    callback('(2/6) Item is present in cache.');

                    const gotItem = cacheInstance.getItem(key);

                    if (!gotItem) {
                        callback('Error: Item could not be get from cache.');

                        return;
                    }

                    callback('(3/6) Item got from cache successfully.');

                    if (!equals(setItem, gotItem)) {
                        const message = 'Error: Retrieved item is different than one created while setting it. If ' +
                            'there are any hooks added, they can alter any data being set / got from cache. If you ' +
                            'know that there are no hooks that might mutate the data in the process, it means that ' +
                            'something is wrong while retrieving data from storage.';

                        callback(message);

                        return;
                    }

                    callback('(4/6) Items are equal.');

                    const result = cacheInstance.removeItem(key);

                    if (!result) {
                        callback('Error: Item could not be removed.');

                        return;
                    }

                    callback('(5/6) Item removed successfully.');

                    const result3 = cacheInstance.hasItem(key);

                    if (result3) {
                        callback('Error: Item still exists.');

                        return;
                    }

                    callback('(6/6) Item is not present in cache.');
                }
            };
        },
        hooks
    };
}
