import { existsSync, readFileSync, writeFileSync } from 'fs';
import { JSDOM } from 'jsdom';

import { CONTENT_PATH_PREFIX, getAllFiles, PAGES_INDEX_PATH, parseFrontMatter } from './common.js';

const MODULES_JSON_PATH = './public/js/modules.json';

if (!existsSync(PAGES_INDEX_PATH)) {
  console.error(`modules.json cannot be created. Page index file '${PAGES_INDEX_PATH}' is missing, please run 'build' task before.`);
  process.exit(1);
}

const getReadmeHtml = (moduleId, fileDirectory) => {
  const html = readFileSync(`./public/modules/${moduleId}/${fileDirectory}/index.html`, { encoding: 'utf-8' });
  const dom = new JSDOM(html);
  return dom.window.document.querySelector('#tab1').innerHTML;
};

const files = getAllFiles(CONTENT_PATH_PREFIX);
const versionedModules = files.reduce((accu, abspath) => {
  const content = readFileSync(abspath, { encoding: 'utf-8' });
  if (!content.includes('commit')) {
    return accu;
  }
  const module = parseFrontMatter(content);
  const index = module.title;

  if (!accu.hasOwnProperty(index)) {
    accu[index] = {};
  }
  accu[index][module.version] = module;

  // latest version does not have directory and locates in module's root
  const fileDirectory = module.versions[module.version].latest ? '' : module.version;
  accu[index][module.version]['readme'] = getReadmeHtml(index, fileDirectory);
  return accu;
}, {});

writeFileSync(MODULES_JSON_PATH, JSON.stringify(versionedModules));
console.info('Modules.json built');
