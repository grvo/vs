// consts de dependências
const gulp = require('gulp');
const es = require('event-stream');
const path = require('path');

// consts locais
const task = require('./lib/task');

const {
    hygiene
} = require('./hygiene');

/**
 * @param {string} actualPath
 */
function checkPackageJSON(actualPath) {
    const actual = require(path.join(__dirname, '..', actualPath));
    const rootPackageJSON = require('../package.json');

    const checkIncluded = (set1, set2) => {
        for (const depName in set1) {
            const depVersion = set1[depName];
            const rootDepVersion = set2[depName];

            if (!rootDepVersion) {
                // ausência no root é permitida
                continue;
            }

            if (depVersion !== rootDepVersion) {
                this.emit(
                    'error',

                    `a dependência ${depName} em '${actualPath}' (${depVersion}) é diferente da que está no package.json root (${rootDepVersion})`
                );
            }
        }
    };

    checkIncluded(actual.dependencies, rootPackageJSON.dependencies);
    checkIncluded(actual.devDependencies, rootPackageJSON.devDependencies);
}

const checkPackageJSONTask = task.define('check-package-json', () => {
    return gulp.src('package.json').pipe(
        es.through(function () {
            checkPackageJSON.call(this, 'remote/package.json');
            checkPackageJSON.call(this, 'remote/web/package.json');
            checkPackageJSON.call(this, 'build/package.json');
        })
    );
});

gulp.task(checkPackageJSONTask);

const hygieneTask = task.define('hygiene', task.series(checkPackageJSONTask, () => hygiene(undefined, false)));

gulp.task(hygieneTask);
