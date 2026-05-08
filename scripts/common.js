import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'fs';
import { join, sep } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export const PAGES_INDEX_DIR = join(__dirname, '../static/js/lunr');
export const PAGES_INDEX_PATH = join(PAGES_INDEX_DIR, 'PagesIndex.json');
export const CONTENT_PATH_PREFIX = 'content/modules';
export const LESS_LOCATIONS = [join(__dirname, '../themes/cfbs-theme/styles'), join(__dirname, '../themes/cfbs-theme/styles/less')];

export const parseFrontMatter = (content) => {
  const m = content.match(/^{([\s\S]*?)^}/m);

  let frontMatter;
  try {
    frontMatter = JSON.parse(m[0]);
  } catch (e) {
    console.error(e.message);
  }
  return frontMatter;
};

export const getAllFiles = (dirPath, arrayOfFiles = []) => {
  const files = readdirSync(dirPath, { withFileTypes: true });
  return files.reduce((accu, file) => {
    const path = join(dirPath, file.name);
    if (file.isDirectory()) {
      arrayOfFiles = getAllFiles(path, arrayOfFiles);
    } else {
      accu.push(path);
    }
    return accu;
  }, arrayOfFiles);
};

export const ensureDir = (filePath) => {
  if (existsSync(filePath)) {
    return;
  }
  let dirPath = filePath.substring(0, filePath.lastIndexOf(sep));
  if (!filePath.substring(filePath.lastIndexOf(sep)).includes('.')) {
    dirPath = filePath;
  }
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
};

export const writeFileSyncInFolder = (filepath, content) => {
  ensureDir(filepath);
  writeFileSync(filepath, content);
};
