import { expect } from 'chai';
import sinon from 'sinon';
import R from 'ramda';
import { createDummyAdapter, nonFunctionValues } from 'stash-it-test-helpers';
import { createCache, createItem } from 'stash-it';

import createDebugPlugin from '../../../src/index';

function upperFirst(string) {
    const firstLetter = string[0];
    const restOfTheString = string.substr(1);

    return `${firstLetter.toUpperCase()}${restOfTheString}`;
}

describe('Debug plugin', () => {
    const callback = sinon.spy();

    beforeEach(() => {
        callback.resetHistory();
    });

    context('when callback is not a function', () => {
        it('should throw', () => {
            nonFunctionValues.forEach((value) => {
                expect(createDebugPlugin.bind(null, value))
                    .to.throw('Callback must be a function.');
            });
        });
    });

    describe('hooks', () => {
        it('should be an array', () => {
            const plugin = createDebugPlugin(callback);

            expect(plugin.hooks).to.be.an('array');
        });

        it('should contain hooks (pre and post) for all pluggable methods base cache instance has', () => {
            const cacheInstance = createCache(createDummyAdapter(createItem));
            const nonPluggableMethods = [ 'addHook', 'addHooks', 'getHooks', 'registerPlugins' ];
            const cacheInstanceWithPluggableMethodsOnly = R.omit(nonPluggableMethods, cacheInstance);
            const pluggableMethods = Object.keys(cacheInstanceWithPluggableMethodsOnly);
            const plugin = createDebugPlugin(callback);
            const hookEvents = plugin.hooks.map((hook) => hook.event);

            pluggableMethods.forEach((methodName) => {
                const preMethodName = `pre${upperFirst(methodName)}`;
                const postMethodName = `post${upperFirst(methodName)}`;

                expect(hookEvents).to.include(preMethodName);
                expect(hookEvents).to.include(postMethodName);
            });
        });

        it('should execute callback for all pluggable methods base cache instance has', () => {
            const plugin = createDebugPlugin(callback);
            const args = { foo: 'bar', baz: 'bam', cacheInstance: 'cacheObject' };

            plugin.hooks.forEach((hook) => {
                callback.resetHistory();

                hook.handler(args);

                expect(callback)
                    .to.have.been.calledWith({
                        event: hook.event,
                        args: R.omit([ 'cacheInstance' ], args)
                    })
                    .to.have.been.calledOnce;
            });
        });

        context('when `withCacheInstance` is set to `true`', () => {
            it('should execute callback with cacheInstance for all pluggable methods cache instance has', () => {
                const plugin = createDebugPlugin(callback, true);
                const args = { foo: 'bar', baz: 'bam', cacheInstance: 'cacheObject' };

                plugin.hooks.forEach((hook) => {
                    callback.resetHistory();

                    hook.handler(args);

                    expect(callback)
                        .to.have.been.calledWith({
                            event: hook.event,
                            args
                        })
                        .to.have.been.calledOnce;
                });
            });
        });

        it('should return the same arguments passed to handler (handler acts as a proxy)', () => {
            const plugin = createDebugPlugin(callback);
            const args = { foo: 'bar', baz: 'bam' };

            plugin.hooks.forEach((hook) => {
                callback.resetHistory();

                const result = hook.handler(args);

                expect(result).to.deep.equal(args);
            });
        });
    });

    describe('createExtensions', () => {
        it('should be a function', () => {
            const plugin = createDebugPlugin(callback);

            expect(plugin.createExtensions).to.be.a('function');
        });

        it('should return an object with runDiagnostics function', () => {
            const plugin = createDebugPlugin(callback);
            const extensions = plugin.createExtensions();

            expect(extensions).to.have.property('runDiagnostics')
                .that.is.a('function');
        });

        context('when registering plugins with stash-it', () => {
            it(`(stash-it) should have plugin's extension present`, () => {
                const cacheInstance = createCache(createDummyAdapter(createItem));
                const plugin = createDebugPlugin(callback);
                const cacheWithPlugin = cacheInstance.registerPlugins([ plugin ]);

                expect(cacheWithPlugin).to.have.property('runDiagnostics')
                    .that.is.a('function');
            });
        });

        describe('runDiagnostics extension', () => {
            const extra = {
                some: 'extraData'
            };
            const combinedExtra = Object.assign({}, extra, { more: 'extraData' });
            const item = {
                key: 'key',
                value: 'value',
                extra
            };
            const dummyCacheInstance = {
                getItem: sinon.stub(),
                getExtra: sinon.stub(),
                hasItem: sinon.stub(),
                removeItem: sinon.stub(),
                setItem: sinon.stub(),
                addExtra: sinon.stub(),
                setExtra: sinon.stub()
            };
            let plugin;

            beforeEach(() => {
                dummyCacheInstance.getExtra.resetHistory();

                dummyCacheInstance.getItem.reset();
                dummyCacheInstance.getItem.returns(item);

                dummyCacheInstance.hasItem.reset();
                dummyCacheInstance.hasItem.onCall(0).returns(false);
                dummyCacheInstance.hasItem.onCall(1).returns(true);
                dummyCacheInstance.hasItem.onCall(2).returns(false);

                dummyCacheInstance.removeItem.reset();
                dummyCacheInstance.removeItem.returns(true);

                dummyCacheInstance.setItem.reset();
                dummyCacheInstance.setItem.withArgs('key', 'value', {}).returns(item);

                dummyCacheInstance.addExtra.reset();
                dummyCacheInstance.addExtra.withArgs('key', extra).returns(combinedExtra);

                dummyCacheInstance.setExtra.reset();
                dummyCacheInstance.setExtra.withArgs('key', extra).returns(extra);

                plugin = createDebugPlugin(callback);
            });

            describe('preliminary check', () => {
                it('should check if item for given key exists', () => {
                    const extensions = plugin.createExtensions(dummyCacheInstance);
                    extensions.runDiagnostics('key');

                    expect(dummyCacheInstance.hasItem.firstCall)
                        .to.have.been.calledWith('key');
                });

                context('when item for given key exists', () => {
                    it('should throw', () => {
                        dummyCacheInstance.hasItem.onCall(0).returns(true);

                        const extensions = plugin.createExtensions(dummyCacheInstance);

                        expect(extensions.runDiagnostics.bind(null, 'key'))
                            .to.throw('You can\'t run diagnostics on existing item. Use different key.');
                    });
                });
            });

            describe('setItem check', () => {
                it('should set an item', () => {
                    const extensions = plugin.createExtensions(dummyCacheInstance);

                    extensions.runDiagnostics('key', 'value');

                    expect(dummyCacheInstance.setItem)
                        .to.have.been.calledWith('key', 'value', {})
                        .to.have.been.calledAfter(dummyCacheInstance.hasItem);
                });

                context('when extra is passed', () => {
                    it('should set an item using passed extra', () => {
                        const extensions = plugin.createExtensions(dummyCacheInstance);

                        extensions.runDiagnostics('key', 'value', 'extra');

                        expect(dummyCacheInstance.setItem)
                            .to.have.been.calledWith('key', 'value', 'extra')
                            .to.have.been.calledAfter(dummyCacheInstance.hasItem)
                            .to.have.been.calledOnce;
                    });
                });

                it('should call callback with set item successful message', () => {
                    const extensions = plugin.createExtensions(dummyCacheInstance);

                    extensions.runDiagnostics('key', 'value');

                    expect(callback)
                        .to.have.been.calledWith('(1/6) Item set successfully.')
                        .to.have.been.calledAfter(dummyCacheInstance.setItem);
                });

                context(`when item was not set`, () => {
                    beforeEach(() => {
                        dummyCacheInstance.setItem.withArgs('key', 'value', {}).returns(false);
                    });

                    it('should call callback with error message', () => {
                        const extensions = plugin.createExtensions(dummyCacheInstance);

                        extensions.runDiagnostics('key', 'value');

                        expect(callback.getCall(0))
                            .to.have.been.calledWith('Error: Could not set item in the cache.');
                    });

                    it('should not perform any other checks', () => {
                        const extensions = plugin.createExtensions(dummyCacheInstance);

                        extensions.runDiagnostics('key', 'value');

                        expect(dummyCacheInstance.hasItem).to.have.been.calledOnce;
                        expect(dummyCacheInstance.getItem).to.not.have.been.called;
                        expect(dummyCacheInstance.removeItem).to.not.have.been.called;
                    });

                    it('should call callback twice', () => {
                        const extensions = plugin.createExtensions(dummyCacheInstance);

                        extensions.runDiagnostics('key', 'value');

                        expect(callback).to.have.been.calledOnce;
                    });
                });
            });

            describe('hasItem check', () => {
                it('should check if item exists', () => {
                    const extensions = plugin.createExtensions(dummyCacheInstance);

                    extensions.runDiagnostics('key', 'value');

                    expect(dummyCacheInstance.hasItem.getCall(1))
                        .to.have.been.calledWith('key');
                });

                it('should call callback with info that item is present in cache', () => {
                    const extensions = plugin.createExtensions(dummyCacheInstance);

                    extensions.runDiagnostics('key', 'value');

                    expect(callback.getCall(1))
                        .to.have.been.calledWith('(2/6) Item is present in cache.');
                });

                context(`when item, after being set, can't be found`, () => {
                    beforeEach(() => {
                        dummyCacheInstance.hasItem.onCall(1).returns(false);
                    });

                    it('should call callback with error message', () => {
                        const extensions = plugin.createExtensions(dummyCacheInstance);

                        extensions.runDiagnostics('key', 'value');

                        expect(callback.getCall(1))
                            .to.have.been.calledWith('Error: Could not find the item in cache.');
                    });

                    it('should not perform any other checks', () => {
                        const extensions = plugin.createExtensions(dummyCacheInstance);

                        extensions.runDiagnostics('key', 'value');

                        expect(dummyCacheInstance.hasItem).to.have.been.calledTwice;
                        expect(dummyCacheInstance.getItem).to.not.have.been.called;
                        expect(dummyCacheInstance.removeItem).to.not.have.been.called;
                    });

                    it('should call callback twice', () => {
                        const extensions = plugin.createExtensions(dummyCacheInstance);

                        extensions.runDiagnostics('key', 'value');

                        expect(callback).to.have.been.calledTwice;
                    });
                });
            });

            it('should get the item', () => {
                const extensions = plugin.createExtensions(dummyCacheInstance);

                extensions.runDiagnostics('key', 'value');

                expect(dummyCacheInstance.getItem)
                    .to.have.been.calledWith('key')
                    .to.have.been.calledAfter(dummyCacheInstance.setItem)
                    .to.have.been.calledOnce;
            });

            context('when item can\'t be retrieved from cache', () => {
                it('should call callback with error message', () => {
                    dummyCacheInstance.getItem.returns(undefined);

                    const extensions = plugin.createExtensions(dummyCacheInstance);

                    extensions.runDiagnostics('key', 'value');

                    expect(callback.getCall(2))
                        .to.have.been.calledWith('Error: Item could not be get from cache.');
                });
            });

            it('should call callback with info that item was retrieved from cache', () => {
                const extensions = plugin.createExtensions(dummyCacheInstance);

                extensions.runDiagnostics('key', 'value');

                expect(callback.getCall(2))
                    .to.have.been.calledWith('(3/6) Item got from cache successfully.');
            });

            context('when item returned by setItem does not equal one returned by getItem', () => {
                const setItem = { key: 'key', value: 'value', extra: 'extra' };
                const gotItem = {
                    ...setItem,
                    key: 'foo'
                };

                beforeEach(() => {
                    dummyCacheInstance.setItem.returns(setItem);
                    dummyCacheInstance.getItem.returns(gotItem);
                });

                it('should call callback with error message', () => {
                    const message = 'Error: Retrieved item is different than one created while setting it. If ' +
                        'there are any hooks added, they can alter any data being set / got from cache. If you ' +
                        'know that there are no hooks that might mutate the data in the process, it means that ' +
                        'something is wrong while retrieving data from storage.';

                    const extensions = plugin.createExtensions(dummyCacheInstance);

                    extensions.runDiagnostics('key', 'value');

                    expect(callback.getCall(3))
                        .to.have.been.calledWith(message);
                });

                it('should not perform any other checks', () => {
                    const extensions = plugin.createExtensions(dummyCacheInstance);

                    extensions.runDiagnostics('key', 'value');

                    expect(dummyCacheInstance.hasItem).to.have.been.calledTwice;
                    expect(dummyCacheInstance.removeItem).to.not.have.been.called;
                });

                it('should call callback 4 times', () => {
                    const extensions = plugin.createExtensions(dummyCacheInstance);

                    extensions.runDiagnostics('key', 'value');

                    expect(callback.callCount).to.eq(4)
                });
            });

            it('should call callback with info that items are equal', () => {
                const extensions = plugin.createExtensions(dummyCacheInstance);

                extensions.runDiagnostics('key', 'value');

                expect(callback.getCall(3))
                    .to.have.been.calledWith('(4/6) Items are equal.');
            });

            it('should remove the item', () => {
                const extensions = plugin.createExtensions(dummyCacheInstance);

                extensions.runDiagnostics('key', 'value');

                expect(dummyCacheInstance.removeItem)
                    .to.have.been.calledWith('key')
                    .to.have.been.calledAfter(dummyCacheInstance.getItem)
                    .to.have.been.calledOnce;
            });

            context('when item could not be removed', () => {
                beforeEach(() => {
                    dummyCacheInstance.removeItem.returns(false);
                });

                it('should call callback with error message', () => {
                    const extensions = plugin.createExtensions(dummyCacheInstance);

                    extensions.runDiagnostics('key', 'value');

                    expect(callback.getCall(4))
                        .to.have.been.calledWith('Error: Item could not be removed.');
                });

                it('should not perform any other checks', () => {
                    const extensions = plugin.createExtensions(dummyCacheInstance);

                    extensions.runDiagnostics('key', 'value');

                    expect(dummyCacheInstance.hasItem).to.have.been.calledTwice;
                });

                it('should call callback 5 times', () => {
                    const extensions = plugin.createExtensions(dummyCacheInstance);

                    extensions.runDiagnostics('key', 'value');

                    expect(callback.callCount).to.eq(5)
                });
            });

            it('should call callback with info that item was removed', () => {
                const extensions = plugin.createExtensions(dummyCacheInstance);

                extensions.runDiagnostics('key', 'value');

                expect(callback.getCall(4))
                    .to.have.been.calledWith('(5/6) Item removed successfully.');
            });

            it('should check if item exists', () => {
                const extensions = plugin.createExtensions(dummyCacheInstance);

                extensions.runDiagnostics('key', 'value');

                expect(dummyCacheInstance.hasItem.getCall(2))
                    .to.have.been.calledWith('key');
            });

            context('when item was found', () => {
                beforeEach(() => {
                    dummyCacheInstance.hasItem.onCall(2).returns(true);
                });

                it('should call callback with error message', () => {
                    const extensions = plugin.createExtensions(dummyCacheInstance);

                    extensions.runDiagnostics('key', 'value');

                    expect(callback.getCall(5))
                        .to.have.been.calledWith('Error: Item still exists.');
                });

                it('should call callback 6 times', () => {
                    const extensions = plugin.createExtensions(dummyCacheInstance);

                    extensions.runDiagnostics('key', 'value');

                    expect(callback.callCount).to.eq(6)
                });
            });

            it('should call callback with info that item was successfully removed', () => {
                const extensions = plugin.createExtensions(dummyCacheInstance);

                extensions.runDiagnostics('key', 'value');

                expect(callback.getCall(5))
                    .to.have.been.calledWith('(6/6) Item is not present in cache.');
            });
        });
    });
});
