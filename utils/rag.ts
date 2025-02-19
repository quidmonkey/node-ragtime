import fs from 'fs';
import path from 'path';

import pdf2md from '@opendocsg/pdf2md';

export const convertDocument = async (
  documentPath: string
): Promise<string> => {
  const filetype = path.extname(documentPath);

  if (filetype === '.pdf') {
    const file = fs.readFileSync(documentPath);
    return pdf2md(file);
  } else if (filetype === '.txt' || filetype === '.md') {
    return fs.readFileSync(documentPath, 'utf8');
  } else {
    throw new Error(`Unsupported file type ${filetype} - Engine only supports pdf, txt, and md files`);
  }
};

// generate a filename from a string
// by removing punctuation and spaces
export const getFilename = (s: string): string => s
  .trim()
  .toLowerCase()
  .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()\?]/g, '')  // remove punctuation
  .replace(/\s+/g, '_');  // remove spaces
