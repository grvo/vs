'use strict';

// const de dependência
const gulp = require('gulp');

// consts locais
const util = require('./lib/util');
const task = require('./lib/task');
const compilation = require('./lib/compilation');
const optimize = require('./lib/optimize');

function makeCompileBuildTask(disableMangle) {
    return task.series(
        util.rimraf('out-build'),
        util.buildWebNodePaths('out-build'),

        compilation.compileApiProposalNamesTask,

        compilation.compileTask('src', 'out-build', true, {
            disableMangle
        }),

        optimize.optimizeLoaderTask('out-build', 'out-build', true)
    );
}

// compilação completa, incluindo fontes nls e inline nos sourcemaps, mangling, minificação, etc
const compileBuildTask = task.define('compile-build', makeCompileBuildTask(false));

gulp.task(compileBuildTask);

exports.compileBuildTask = compileBuildTask;

// compilação completa para ci de pull requests
const compileBuildTaskPullRequest = task.define('compile-build-pr', makeCompileBuildTask(true));

gulp.task(compileBuildTaskPullRequest);

exports.compileBuildTaskPullRequest = compileBuildTaskPullRequest;
