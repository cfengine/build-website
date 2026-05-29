import { createHash } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import less from 'less';
import { extname } from 'path';
import { minify } from 'uglify-js';

import { CONTENT_PATH_PREFIX, getAllFiles, PAGES_INDEX_PATH, LESS_LOCATIONS, parseFrontMatter, writeFileSyncInFolder } from './common.js';
import { createAuthorResolver } from './authors.js';

const getFormattedDate = (date) => date.toLocaleDateString('en-us', { year: 'numeric', month: 'short', day: 'numeric' });

const getContent = async (readmeUrl, readmeSHA256) => {
  console.log('fetching readme', readmeUrl);
  const content = await fetch(`https://cfbs.s3.amazonaws.com/${readmeUrl}`).then((res) => res.text());
  const extension = extname(readmeUrl);

  const checksum = createHash('sha256').update(content).digest('hex');

  if (checksum !== readmeSHA256) {
    console.error(`${readmeUrl} checksum is wrong`);
    process.exit(1);
  }

  return { content, extension };
};

const processVersions = async (current, versions, frontmatter) =>
  Object.entries(versions).reduce(async (accu, [version, { commit, subdirectory, readme_url, readme_sha256 }]) => {
    if (current === version) return accu;
    let copiedFM = { ...frontmatter, hide: true, id: `${frontmatter.id}@${version}`, version, commit, subdirectory };
    let content = 'Readme not found';
    let extension = '.html';
    if (readme_url != null) {
      ({ content, extension } = await getContent(readme_url, readme_sha256));
    }
    (await accu).push({ content, extension, frontmatter: copiedFM, version });
    return accu;
  }, []);

const modulesUpdate = async () => {
  const headers = process.env.GITHUB_USERNAME_TOKEN
    ? {
        Authorization: 'Basic ' + Buffer.from(process.env.GITHUB_USERNAME_TOKEN).toString('base64')
      }
    : {};
  if (!headers.Authorization) {
    console.error('GITHUB_USERNAME_TOKEN env variable is not set. Format is: username@token. Consider setting this, to not get rate limited.');
  }
  const response = await fetch('https://raw.githubusercontent.com/cfengine/build-index/master/cfbs.json', { headers }).then((res) => res.json());
  const versions = await fetch('https://raw.githubusercontent.com/cfengine/build-index/master/versions.json', { headers }).then((res) => res.json());
  const limit = await fetch('https://api.github.com/rate_limit', { headers }).then((res) => res.json());
  const downloadStat = await fetch('https://archive.build.cfengine.com/stats').then((res) => res.json());
  console.log(`Remaining limit: ${limit.resources.core.remaining}`);

  const modules = response.index;
  const authorsFile = readFileSync('./static/js/authors.json', { encoding: 'utf-8' });
  let authors = {};
  try {
    authors = JSON.parse(authorsFile);
  } catch (error) {
    console.error('parsing authors failed:', error);
    return;
  }
  const authorResolver = createAuthorResolver({ cache: authors, headers });

  for (const index in modules) {
    const module = modules[index];
    if (!module.hasOwnProperty('alias')) {
      const author = await authorResolver.resolve(module.by);

      // content
      let content;
      let extension = '.html';
      let version = {};

      if (versions[index] && (version = versions[index][module.version]) && version.readme_url != null) {
        ({ content, extension } = await getContent(version.readme_url, version.readme_sha256));
      } else {
        content = 'Readme not found';
      }
      const discussionParams = new URLSearchParams({
        category: 'modules',
        title: index,
        body: 'I have a question regarding...'
      })
      const discussionSearch = new URLSearchParams({
        discussions_q: `is:open category:Modules ${index}`
      })
      // frontmatters
      let frontmatter = {
        title: index,
        date: new Date(version.timestamp),
        id: index,
        description: module.description || '',
        author,
        versions: {},
        updated: getFormattedDate(new Date(version.timestamp)),
        downloads: downloadStat[index] ?? 0,
        repo: module.repo,
        documentation: module.documentation || null,
        website: module.website || null,
        subdirectory: module.subdirectory,
        commit: module.commit,
        dependencies: module.dependencies || [],
        tags: module.tags || [],
        layout: 'single',
        discussion: `https://github.com/cfengine/core/discussions/new?${discussionParams.toString()}`,
        discussionSearch: `https://github.com/cfengine/core/discussions/categories/modules?${discussionSearch.toString()}`
      };

      if (module.hasOwnProperty('version')) {
        frontmatter.version = module.version;
        const moduleVersions = versions[index];
        frontmatter.versions = Object.keys(moduleVersions).reduce((reducer, version) => {
          reducer[version] = { date: getFormattedDate(new Date(moduleVersions[version].timestamp)), latest: version == module.version };
          return reducer;
        }, {});

        (await processVersions(module.version, moduleVersions, frontmatter)).forEach((item) => {
          writeFileSyncInFolder(`content/modules/${index}/${item.version}${extension}`, `${JSON.stringify(item.frontmatter, null, 2)}\n${item.content}`);
        });
      }
      // frontmatters end
      writeFileSyncInFolder(`content/modules/${index}/_index${extension}`, `${JSON.stringify(frontmatter, null, 2)}\n${content}`);

      // write module page for the latest version
      frontmatter.id += `@${module.version}`;
      frontmatter.hide = true;
      writeFileSync(`content/modules/${index}/${module.version}${extension}`, `${JSON.stringify(frontmatter, null, 2)}\n${content}`);

      console.info(`${index} page created`);
    }
  }
  if (authorResolver.isDirty()) {
    writeFileSyncInFolder('static/js/authors.json', JSON.stringify(authors, null, 2));
  }
  console.info('modules update done');
};

const processFile = (abspath) => {
  const content = readFileSync(abspath, { encoding: 'utf-8' });
  if (!content.includes('commit')) {
    return null;
  }
  const frontMatter = parseFrontMatter(content);

  // exclude hidden pages
  if (frontMatter.hide == true) {
    return null;
  }

  const match = abspath.match(/content(\/modules\/.*\/)/);

  // Build Lunr index for this page
  const pageIndex = {
    ...frontMatter,
    href: match[1]
  };

  return pageIndex;
};

const indexPages = () => {
  let pagesIndex = {};
  const files = getAllFiles(CONTENT_PATH_PREFIX);
  files.map((abspath) => {
    console.log('Parse file:', abspath);
    const index = processFile(abspath);
    if (index !== null) {
      pagesIndex[index.id] = index;
    }
    return;
  });
  return pagesIndex;
};

const lunrIndex = () => {
  writeFileSyncInFolder(PAGES_INDEX_PATH, JSON.stringify(indexPages()));
  console.info('Index built');
};

const cssTarget = './themes/cfbs-theme/static/css/style.min.css';
const lessSource = './themes/cfbs-theme/styles/cfbs.less';
const createLess = () => {
  const lessInput = readFileSync(lessSource, { encoding: 'utf-8' });

  less.render(lessInput, { compress: true, yuicompress: true, optimization: 2, paths: LESS_LOCATIONS }).then(
    ({ css }) => writeFileSyncInFolder(cssTarget, css),
    (error) => console.error(error)
  );
};

const codeTargets = [
  { sources: ['./static/js/main.js'], target: './static/js/bundles/main.js' },
  { sources: ['./node_modules/flexsearch/dist/flexsearch.bundle.min.js', './static/js/modules-list.js'], target: './static/js/bundles/modules-page.js' }
];
const minifyCode = () => {
  const output = codeTargets.map(({ sources, target }) => {
    const code = sources.reduce((accu, source, index) => {
      accu[`source-${index}`] = readFileSync(source, { encoding: 'utf-8' });
      return accu;
    }, {});
    const result = minify(code);
    return { target, code: result.code };
  });

  output.map(({ code, target }) => writeFileSyncInFolder(target, code));
};

await modulesUpdate();
lunrIndex();
createLess();
minifyCode();
