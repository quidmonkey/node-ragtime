import fs from 'fs';
import path from 'path';

import { Command } from 'commander';
import { sync as globSync } from 'glob';
 
import config from './environment';
import {
  Corpus,
  convertDocument,
  createDatabases,
  getFilename,
  saveDatabases
} from './utils/etl';

const Program = new Command();

const main = async (documentPath: string, databaseName: string) => {
  const corpus: Corpus = {};
  const filepaths = fs.lstatSync(documentPath).isDirectory()
    ? globSync(`${documentPath}/*`)
    : [documentPath];

  for (const filepath of filepaths) {
    const text = await convertDocument(filepath);
    const title = path.basename(filepath);

    corpus[title] = text;
  }
  
  const databases = await createDatabases(corpus);

  const formattedModel = getFilename(config.LLM);
  const formattedName = databaseName ?? getFilename(documentPath);
  const keywordDatabasePath = `${formattedModel}-${formattedName}-keyword-database.json`;
  const semanticDatabasePath = `${formattedModel}-${formattedName}-semantic-vector.db`;

  await saveDatabases(databases, { keywordDatabasePath, semanticDatabasePath, });

  process.exit();
};


Program
  .description('Generate an imvector and minisearch database for search queries using LLM Rag')
  .argument('[documentPath]', 'Path to a document or directory of documents')
  .argument('<databaseName>', 'Name of the database to save')
  .action(main)
  .parse();
