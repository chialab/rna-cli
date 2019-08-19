module.exports = function dependencyCheck(project, options = {}) {
    const exclude = options.exclude || [];

    let projectDependencies = null;
    if (project) {
        projectDependencies = [
            ...Object.keys(project.get('dependencies') || {}),
            ...Object.keys(project.get('peerDependencies') || {}),
            ...Object.keys(project.get('devDependencies') || {}),
        ];
    }

    return {
        name: 'rollup-plugin-dependency-check',

        resolveId(importee, importer) {
            if (!importer) {
                return null;
            }
            if (!projectDependencies) {
                return null;
            }
            if (importee.indexOf('./') === 0 || importee.indexOf('../') === 0) {
                return null;
            }
            if (importer.indexOf('/node_modules/') !== -1) {
                return null;
            }
            if (importee.indexOf('\0') === 0) {
                return null;
            }
            let split = importee.split('/');
            let moduleName = split[0];
            if (!moduleName) {
                return null;
            }
            if (importee[0] === '@') {
                moduleName += `/${split[1]}`;
            }
            if (exclude.indexOf(moduleName) !== -1) {
                return null;
            }
            if (projectDependencies.indexOf(moduleName) === -1) {
                let warning = `dependency '${moduleName}' is not listed in ${project.packageJson.localPath}`;
                let warnings = this.warnings = this.warnings || [];
                if (warnings.indexOf(warning) === -1) {
                    warnings.push(warning);
                    this.warn({
                        message: warning,
                    });
                }
            }
            return null;
        },
    };
};
