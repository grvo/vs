// @ts-check

'use strict';

// armazena a função require do node.js em uma variável
// antes de carregar o loader do amd para isolar erros
// quando o arquivo é bundlado em outros arquivos
const nodeRequire = require;

// vs_globals: node_modules
globalThis._VS_NODE_MODULES = new Proxy(Object.create(null), {
    get: (_target, mod) => nodeRequire(String(mod))
});

// vs_globals: package/product.json
/** @type Record<string, any> */
globalThis._VS_PRODUCT_JSON = require('../product.json');

if (process.env['VS_DEV']) {
    // produto do patch sobrepõe ao rodar das fontes
    try {
        // @ts-ignore
        const overrides = require('../product.overrides.json');

        globalThis._VS_PRODUCT_JSON = Object.assign(globalThis._VS_PRODUCT_JSON, overrides);
    } catch (error) {
        /* ignorar */
    }
}

globalThis._VS_PACKAGE_JSON = require('../package.json');

// @ts-ignore
const loader = require('./vs/loader');
const bootstrap = require('./bootstrap');
const performance = require('./vs/base/common/performance');

// bootstrap: nls
const nlsConfig = bootstrap.setupNLS();

// bootstrap: loader
loader.config({
    baseUrl: bootstrap.fileUriFromPath(__dirname, {
        isWindows: process.platform === 'win32'
    }),

    catchError: true,
    nodeRequire,
    'vs/nls': nlsConfig,
    amdModulesPattern: /^vs\//,
    recordStats: true
});

// rodando no electron
if (process.env['ELECTRON_RUN_AS_NODE'] || process.versions['electron']) {
    loader.define('fs', ['original-fs'], function (/** @type {import('fs')} */ originalFS) {
        return originalFS;
    });
}

// suporte de pseudo nls
if (nlsConfig && nlsConfig.pseudo) {
    loader(['vs/nls'], function (/** @type {import('vs/nls')} */ nlsPlugin) {
        nlsPlugin.setPseudoTranslation(!!nlsConfig.pseudo);
    });
}

/**
 * @param {string=} entrypoint
 * @param {(value: any) => void=} onLoad
 * @param {(err: Error) => void=} onError
 */
exports.load = function (entrypoint, onLoad, onError) {
    if (!entrypoint) {
        return;
    }

    // configuração de cache do código
    if (process.env['VS_CODE_CACHE_PATH']) {
        loader.config({
            nodeCachedData: {
                path: process.env['VS_CODE_CACHE_PATH'],
                seed: entrypoint
            }
        });
    }

    onLoad = onLoad || function () { };

    onError = onError || function (err) {
        console.error(err);
    };

    performance.mark('code/fork/willLoadCode');

    loader([entrypoint], onLoad, onError);
};
