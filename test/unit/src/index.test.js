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
            const additionalExtra = { ___someAdditionalExtra___: '___someAdditionalValue___' };
            const extendedExtra = Object.assign({}, extra, additionalExtra);
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

            function runDiagnostics(cacheInstance) {
                return plugin
                        .createExtensions(cacheInstance)
                        .runDiagnostics('key', 'value', extra);
            }

            beforeEach(() => {
                dummyCacheInstance.getExtra.resetHistory();
                dummyCacheInstance.getExtra.withArgs('key').returns(extra);

                dummyCacheInstance.getItem.reset();
                dummyCacheInstance.getItem.withArgs('key').returns(item);

                dummyCacheInstance.hasItem.reset();
                dummyCacheInstance.hasItem.onCall(0).returns(false);
                dummyCacheInstance.hasItem.onCall(1).returns(true);
                dummyCacheInstance.hasItem.onCall(2).returns(false);

                dummyCacheInstance.removeItem.reset();
                dummyCacheInstance.removeItem.returns(true);

                dummyCacheInstance.setItem.reset();
                dummyCacheInstance.setItem.withArgs('key', 'value', extra).returns(item);

                dummyCacheInstance.addExtra.reset();
                dummyCacheInstance.addExtra.withArgs('key', additionalExtra).returns(extendedExtra);

                dummyCacheInstance.setExtra.reset();
                dummyCacheInstance.setExtra.withArgs('key', extra).returns(extra);

                plugin = createDebugPlugin(callback);
            });

            describe('preliminary check', () => {
                it('should check if item for given key exists', () => {
                    runDiagnostics(dummyCacheInstance);

                    expect(dummyCacheInstance.hasItem.firstCall)
                        .to.have.been.calledWith('key');
                });

                context('when item for given key exists', () => {
                    it('should call callback with failure message', () => {
                        dummyCacheInstance.hasItem.onCall(0).returns(true);

                        runDiagnostics(dummyCacheInstance).then(() => {
                            expect(callback.getCall(0))
                                .to.have.been.calledWith(
                                    `You can't run diagnostics on existing item. Use different key.`
                            );
                        });
                    });

                    it('should call callback with failure finished message', () => {
                        dummyCacheInstance.hasItem.onCall(0).returns(true);

                        runDiagnostics(dummyCacheInstance).then(() => {
                            expect(callback.getCall(1))
                                .to.have.been.calledWith('Finished: FAILURE.');
                        });
                    });
                });
            });

            describe('setItem check', () => {
                it('should set an item', () => {
                    runDiagnostics(dummyCacheInstance).then(() => {
                        expect(dummyCacheInstance.setItem)
                            .to.have.been.calledWith('key', 'value', extra)
                            .to.have.been.calledAfter(dummyCacheInstance.hasItem);
                    });
                });

                it('should call callback with set item successful message', () => {
                    runDiagnostics(dummyCacheInstance).then(() => {
                        expect(callback)
                            .to.have.been.calledWith('(1/9) Item set successfully.')
                            .to.have.been.calledAfter(dummyCacheInstance.setItem);
                    });
                });

                context(`when item was not set`, () => {
                    beforeEach(() => {
                        dummyCacheInstance.setItem.withArgs('key', 'value', extra).returns(false);
                    });

                    it('should call callback with error message', () => {
                        runDiagnostics(dummyCacheInstance).then(() => {
                            expect(callback.getCall(0))
                                .to.have.been.calledWith('Error: Could not set item in the cache.');
                        });
                    });

                    it('should call callback with failure finished message', () => {
                        runDiagnostics(dummyCacheInstance).then(() => {
                            expect(callback.getCall(1))
                                .to.have.been.calledWith('Finished: FAILURE.');
                        });
                    });

                    it('should not perform any further checks', () => {
                        runDiagnostics(dummyCacheInstance).then(() => {
                            expect(dummyCacheInstance.getItem).to.not.have.been.called;
                            expect(dummyCacheInstance.removeItem).to.not.have.been.called;
                            expect(dummyCacheInstance.getExtra).to.not.have.been.called;
                        });
                    });
                });
            });

            describe('hasItem check', () => {
                it('should check if item exists', () => {
                    runDiagnostics(dummyCacheInstance).then(() => {
                        expect(dummyCacheInstance.hasItem.getCall(1))
                            .to.have.been.calledWith('key');
                    });
                });

                it('should call callback with info that item is present in cache', () => {
                    runDiagnostics(dummyCacheInstance).then(() => {
                        expect(callback.getCall(1))
                            .to.have.been.calledWith('(2/9) Item is present in cache.');
                    });
                });

                context(`when item, after being set, can't be found`, () => {
                    beforeEach(() => {
                        dummyCacheInstance.hasItem.onCall(1).returns(false);
                    });

                    it('should call callback with error message', () => {
                        runDiagnostics(dummyCacheInstance).then(() => {
                            expect(callback.getCall(1))
                                .to.have.been.calledWith('Error: Could not find the item in cache.');
                        });
                    });

                    it('should call callback with failure finished message', () => {
                        runDiagnostics(dummyCacheInstance).then(() => {
                            expect(callback.getCall(2))
                                .to.have.been.calledWith('Finished: FAILURE.');
                        });
                    });

                    it('should not perform any further checks', () => {
                        runDiagnostics(dummyCacheInstance).then(() => {
                            expect(dummyCacheInstance.getItem).to.not.have.been.called;
                            expect(dummyCacheInstance.removeItem).to.not.have.been.called;
                        });
                    });
                });
            });

            describe('getItem check', () => {
                it('should get the item', () => {
                    runDiagnostics(dummyCacheInstance).then(() => {
                        expect(dummyCacheInstance.getItem)
                            .to.have.been.calledWith('key')
                            .to.have.been.calledAfter(dummyCacheInstance.setItem)
                            .to.have.been.calledOnce;
                    });
                });

                it('should call callback with info that item was retrieved from cache', () => {
                    runDiagnostics(dummyCacheInstance).then(() => {
                        expect(callback.getCall(2))
                            .to.have.been.calledWith('(3/9) Item got from cache successfully.');
                    });
                });

                context(`when item can't be retrieved from cache`, () => {
                    beforeEach(() => {
                        dummyCacheInstance.getItem.withArgs('key').returns(undefined);
                    });

                    it('should call callback with error message', () => {
                        runDiagnostics(dummyCacheInstance).then(() => {
                            expect(callback.getCall(2))
                                .to.have.been.calledWith('Error: Item could not be get from cache.');
                        });
                    });

                    it('should call callback with failure finished message', () => {
                        runDiagnostics(dummyCacheInstance).then(() => {
                            expect(callback.getCall(3))
                                .to.have.been.calledWith('Finished: FAILURE.');
                        });
                    });

                    it('should not perform any further checks', () => {
                        runDiagnostics(dummyCacheInstance).then(() => {
                            expect(dummyCacheInstance.removeItem).to.not.have.been.called;
                        });
                    });
                });
            });

            describe('items comparison check', () => {
                it('should call callback with info that items are equal', () => {
                    runDiagnostics(dummyCacheInstance).then(() => {
                        expect(callback.getCall(3))
                            .to.have.been.calledWith('(4/9) Items are equal.');
                    });
                });

                context('when item returned by setItem does not equal the one returned by getItem', () => {
                    const setItem = { key: 'key', value: 'value', extra: 'extra' };
                    const gotItem = {
                        ...setItem,
                        key: 'foo'
                    };

                    beforeEach(() => {
                        dummyCacheInstance.setItem.withArgs('key').returns(setItem);
                        dummyCacheInstance.getItem.withArgs('key').returns(gotItem);
                    });

                    it('should call callback with error message', () => {
                        const message = 'Error: Retrieved item is different than one created while setting it. If ' +
                            'there are any hooks added, they can alter any data being set / got from cache. If you ' +
                            'know that there are no hooks that might mutate the data in the process, it means that ' +
                            'something is wrong while retrieving data from storage.';

                        runDiagnostics(dummyCacheInstance).then(() => {
                            expect(callback.getCall(3))
                                .to.have.been.calledWith(message);
                        });
                    });

                    it('should call callback with failure finished message', () => {
                        runDiagnostics(dummyCacheInstance).then(() => {
                            expect(callback.getCall(4))
                                .to.have.been.calledWith('Finished: FAILURE.');
                        });
                    });

                    it('should not perform any other checks', () => {
                        runDiagnostics(dummyCacheInstance).then(() => {
                            expect(dummyCacheInstance.removeItem).to.not.have.been.called;
                        });
                    });
                });
            });

            describe('getExtra check', () => {
                it('should get extra for given item identified by a key', () => {
                    runDiagnostics(dummyCacheInstance).then(() => {
                        expect(dummyCacheInstance.getExtra)
                            .to.have.been.calledWith('key')
                            .to.have.been.calledAfter(dummyCacheInstance.getItem)
                            .to.have.been.calledOnce;
                    });
                });

                it('should call callback with info that extra was retrieved from cache', () => {
                    runDiagnostics(dummyCacheInstance).then(() => {
                        expect(callback.getCall(4))
                            .to.have.been.calledWith('(5/9) Extra got from cache successfully.');
                    });
                });

                context(`when extra can't be retrieved from cache`, () => {
                    beforeEach(() => {
                        dummyCacheInstance.getExtra.withArgs('key').returns(undefined);
                    });

                    it('should call callback with error message', () => {
                        runDiagnostics(dummyCacheInstance).then(() => {
                            expect(callback.getCall(4))
                                .to.have.been.calledWith('Error: Extra could not be get from cache.');
                        });
                    });

                    it('should call callback with failure finished message', () => {
                        runDiagnostics(dummyCacheInstance).then(() => {
                            expect(callback.getCall(5))
                                .to.have.been.calledWith('Finished: FAILURE.');
                        });
                    });

                    it('should not perform any other checks', () => {
                        runDiagnostics(dummyCacheInstance).then(() => {
                            expect(dummyCacheInstance.removeItem).to.not.have.been.called;
                        });
                    });
                });
            });

            describe('addExtra check', () => {
                it('should add extra for given item identified by a key', () => {
                    runDiagnostics(dummyCacheInstance).then(() => {
                        expect(dummyCacheInstance.addExtra)
                            .to.have.been.calledWith('key', additionalExtra)
                            .to.have.been.calledAfter(dummyCacheInstance.getExtra)
                            .to.have.been.calledOnce;
                    });
                });

                it('should call callback with info that extra was added to cache', () => {
                    runDiagnostics(dummyCacheInstance).then(() => {
                        expect(callback.getCall(5))
                            .to.have.been.calledWith('(6/9) Extra added to cache successfully.');
                    });
                });

                context(`when extra can't be added to cache`, () => {
                    beforeEach(() => {
                        dummyCacheInstance.addExtra.withArgs('key', additionalExtra).returns(undefined);
                    });

                    it('should call callback with error message', () => {
                        runDiagnostics(dummyCacheInstance).then(() => {
                            expect(callback.getCall(5))
                                .to.have.been.calledWith('Error: Extra could not be added to cache.');
                        });
                    });

                    it('should call callback with failure finished message', () => {
                        runDiagnostics(dummyCacheInstance).then(() => {
                            expect(callback.getCall(6))
                                .to.have.been.calledWith('Finished: FAILURE.');
                        });
                    });

                    it('should not perform any other checks', () => {
                        runDiagnostics(dummyCacheInstance).then(() => {
                            expect(dummyCacheInstance.setExtra).to.not.have.been.called;
                            expect(dummyCacheInstance.removeItem).to.not.have.been.called;
                            expect(dummyCacheInstance.hasItem).to.have.been.calledTwice;
                        });
                    });
                });
            });

            describe('setExtra check', () => {
                it('should add extra for given item identified by a key', () => {
                    runDiagnostics(dummyCacheInstance).then(() => {
                        expect(dummyCacheInstance.setExtra)
                            .to.have.been.calledWith('key', extra)
                            .to.have.been.calledAfter(dummyCacheInstance.addExtra)
                            .to.have.been.calledOnce;
                    });
                });

                it('should call callback with info that extra was set in cache', () => {
                    runDiagnostics(dummyCacheInstance).then(() => {
                        expect(callback.getCall(6))
                            .to.have.been.calledWith('(7/9) Extra set in cache successfully.');
                    });
                });

                context(`when extra can't be set in cache`, () => {
                    beforeEach(() => {
                        dummyCacheInstance.setExtra.withArgs('key', extra).returns(undefined);
                    });

                    it('should call callback with error message', () => {
                        runDiagnostics(dummyCacheInstance).then(() => {
                            expect(callback.getCall(6))
                                .to.have.been.calledWith('Error: Extra could not be set in cache.');
                        });
                    });

                    it('should call callback with failure finished message', () => {
                        runDiagnostics(dummyCacheInstance).then(() => {
                            expect(callback.getCall(7))
                                .to.have.been.calledWith('Finished: FAILURE.');
                        });
                    });

                    it('should not perform any other checks', () => {
                        runDiagnostics(dummyCacheInstance).then(() => {
                            expect(dummyCacheInstance.removeItem).to.not.have.been.called;
                            expect(dummyCacheInstance.hasItem).to.have.been.calledTwice;
                        });
                    });
                });
            });

            describe('removeItem check', () => {
                it('should remove the item', () => {
                    runDiagnostics(dummyCacheInstance).then(() => {
                        expect(dummyCacheInstance.removeItem)
                            .to.have.been.calledWith('key')
                            .to.have.been.calledAfter(dummyCacheInstance.setExtra)
                            .to.have.been.calledOnce;
                    });
                });

                it('should call callback with info that item was removed', () => {
                    runDiagnostics(dummyCacheInstance).then(() => {
                        expect(callback.getCall(7))
                            .to.have.been.calledWith('(8/9) Item removed successfully.');
                    });
                });

                context('when item could not be removed', () => {
                    beforeEach(() => {
                        dummyCacheInstance.removeItem.returns(false);
                    });

                    it('should call callback with error message', () => {
                        runDiagnostics(dummyCacheInstance).then(() => {
                            expect(callback.getCall(7))
                                .to.have.been.calledWith('Error: Item could not be removed.');
                        });
                    });

                    it('should call callback with failure finished message', () => {
                        runDiagnostics(dummyCacheInstance).then(() => {
                            expect(callback.getCall(8))
                                .to.have.been.calledWith('Finished: FAILURE.');
                        });
                    });

                    it('should not perform any other checks', () => {
                        runDiagnostics(dummyCacheInstance).then(() => {
                            expect(dummyCacheInstance.hasItem).to.have.been.calledTwice;
                        });
                    });
                });
            });

            describe('hasItem check after item was removed', () => {
                it('should check if item exists', () => {
                    runDiagnostics(dummyCacheInstance).then(() => {
                        expect(dummyCacheInstance.hasItem.getCall(2))
                            .to.have.been.calledWith('key');
                    });
                });

                it('should call callback with info that item was successfully removed', () => {
                    runDiagnostics(dummyCacheInstance).then(() => {
                        expect(callback.getCall(8))
                            .to.have.been.calledWith('(9/9) Item is not present in cache.');
                    });
                });

                context('when item was found', () => {
                    beforeEach(() => {
                        dummyCacheInstance.hasItem.onCall(2).returns(true);
                    });

                    it('should call callback with error message', () => {
                        runDiagnostics(dummyCacheInstance).then(() => {
                            expect(callback.getCall(8))
                                .to.have.been.calledWith('Error: Item still exists.');
                        });
                    });

                    it('should call callback with failure finished message', () => {
                        runDiagnostics(dummyCacheInstance).then(() => {
                            expect(callback.getCall(9))
                                .to.have.been.calledWith('Finished: FAILURE.');
                        });
                    });
                });
            });
        });
    });
});
