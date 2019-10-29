/**
 * Copyright (c) 2018 Andrew Carpenter
 * @see https://github.com/doesdev/rollup-plugin-analyzer
 * @see https://github.com/doesdev/rollup-plugin-analyzer/issues/15
 */

function shakenPct(n, o) {
    return Math.max((100 - ((n / o) * 100)).toFixed(2), 0);
}

function analyzer(bundle, options = {}) {
    const root = options.root || (process && process.cwd ? process.cwd() : null);

    const deps = {};
    const bundleModules = bundle.modules || (bundle.cache || {}).modules || [];
    const moduleCount = bundleModules.length;

    let bundleSize = 0;
    let bundleOrigSize = 0;

    let modules = bundleModules.map((mod) => {
        const { originalLength: origSize, renderedLength, code, renderedExports, removedExports } = mod;
        const id = mod.id.replace(root, '');

        let size = renderedLength;
        if (!size && size !== 0) {
            size = code ? Buffer.byteLength(code, 'utf8') : 0;
        }
        bundleSize += size;
        bundleOrigSize += origSize;

        mod.dependencies.forEach((d) => {
            d = d.replace(root, '');
            deps[d] = deps[d] || [];
            deps[d].push(id);
        });

        return {
            id,
            size,
            origSize,
            renderedExports,
            removedExports,
        };
    }).filter((m) => m);

    modules.sort((a, b) => b.size - a.size);
    modules.forEach((m) => {
        m.dependents = deps[m.id] || [];
        m.percent = Math.min(((m.size / bundleSize) * 100).toFixed(2), 100);
        m.reduction = shakenPct(m.size, m.origSize);
    });

    const bundleReduction = shakenPct(bundleSize, bundleOrigSize);

    return {
        bundleSize,
        bundleOrigSize,
        bundleReduction,
        modules,
        moduleCount,
    };
}

function analyze(bundle, opts) {
    return new Promise((resolve, reject) => {
        try {
            const analysis = analyzer(bundle, opts);
            return resolve(analysis);
        } catch (ex) {
            return reject(ex);
        }
    });
}

module.exports = function(options = {}) {
    return {
        name: 'rollup-plugin-analyzer',
        generateBundle(outOpts, bundle) {
            const ctx = this || {};
            const getDeps = (id) => (ctx.getModuleInfo ? ctx.getModuleInfo(id).importedIds : []);

            const modules = [];
            Object.entries(bundle).forEach(([, { modules: bundleMods }]) => {
                if (!bundleMods) {
                    return;
                }
                Object.entries(bundleMods).forEach(([id, moduleInfo]) => {
                    const dependencies = getDeps(id);
                    modules.push(Object.assign({}, moduleInfo, {
                        id,
                        dependencies,
                    }));
                });
            });

            return analyze({ modules }, options)
                .then(options.onAnalysis)
                .catch(options.onError);
        },
    };
};
