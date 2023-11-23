// @ts-check

'use strict';

// deletar `vs_cwd` o quanto antes de importar os
// arquivos do bootstrap. nós já vimos os reports
// onde `code .` usará o diretório de trabalho
// errado para a variável, escapando para o
// shell parente
//
// (https://github.com/microsoft/vscode/issues/126399)

delete process.env['VS_CWD'];

const bootstrap = require('./bootstrap');
const bootstrapNode = require('./bootstrap-node');
const product = require('../product.json');

// habilitar suporte portátil
bootstrapNode.configurePortable(product);

// habilitar suporte asar
bootstrap.enableASARSupport();

// processos que foram lançados como cli
process.env['VS_CLI'] = '1';

// carregar o cli dentro do loader amd
require('./bootstrap-amd').load('vs/code/node/cli');
