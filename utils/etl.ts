import fs from 'node:fs';
import path from 'node:path';
import {RecursiveCharacterTextSplitter} from '@langchain/textsplitters';
import pdf2md from '@opendocsg/pdf2md';
import {sync as globSync} from 'glob';
import {VectorDB} from 'imvectordb';
import chunk from 'lodash/chunk';
import max from 'lodash/max';
import min from 'lodash/min';
import zipObject from 'lodash/zipObject';
import MiniSearch from 'minisearch';
import ollama from 'ollama';
import config from '../environment.js';

export type Chunk = string[];
export type Corpus = Record<Title, File>;
export type Embedding = number[];
export type File = string;
export type Title = string;
export type Texts = Record<Title, Chunk>;

type Databases = {
  keywordDatabase: MiniSearch;
  semanticDatabase: VectorDB;
};

export const batchCreateDatabases = async (
  corpus: Corpus,
  batchSize = 50,
): Promise<Databases> => {
  const [
    keywordDatabase,
    semanticDatabase,
  ] = await Promise.all([
    createKeywordDatabase(corpus),
    batchCreateSemanticDatabase(corpus, batchSize),
  ]);

  return {
    keywordDatabase,
    semanticDatabase,
  };
};

export const batchCreateSemanticDatabase = async (
  corpus: Corpus,
  batchSize = 50,
): Promise<VectorDB> => {
  console.info('Creating Semantic Vector Database');

  const db = new VectorDB();

  const texts = await chunkCorpus(corpus);

  let id = 1;

  const documents = Object.entries(texts);

  for (const [title, chunks] of documents) {
    const batches: Chunk[] = chunk(chunks, batchSize);

    for (const batch of batches) {
      const promises = batch.map(async chunk => getEmbedding(chunk));
      const embeddings = await Promise.all(promises);

      for (const embedding of embeddings) {
        db.add({
          id: id.toString(),
          embedding,
          metadata: {
            text: chunk,
            title,
          },
        });

        id++;
      }
    }

    console.info('Created Semantic Embeddings for', title);
  }

  console.info('Created Semantic Vector Database');

  return db;
};

export const chunkCorpus = async (
  corpus: Corpus,
): Promise<Texts> => {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: config.EMBEDDING_CHUNK_SIZE,
    chunkOverlap: config.EMBBEDING_OVERLAP_SIZE,
  });

  const promises = Object.values(corpus)
    .map(text => splitter.createDocuments([text]));
  const texts = await Promise.all(promises);

  const chunks = texts.map(chunks =>
    chunks.map(chunk => chunk.pageContent),
  );

  return zipObject(Object.keys(corpus), chunks);
};

export const convertDocument = async (
  documentPath: string,
): Promise<string> => {
  const filetype = path.extname(documentPath);

  if (filetype === '.pdf') {
    const file = fs.readFileSync(documentPath);
    return pdf2md(file);
  }

  if (filetype === '.txt' || filetype === '.md') {
    return fs.readFileSync(documentPath, 'utf8');
  }

  throw new Error(`Unsupported file type ${filetype} - Engine only supports pdf, txt, and md files`);
};

export const createDatabases = async (
  corpus: Corpus,
): Promise<Databases> => {
  const [
    keywordDatabase,
    semanticDatabase,
  ] = await Promise.all([
    createKeywordDatabase(corpus),
    createSemanticDatabase(corpus),
  ]);

  return {
    keywordDatabase,
    semanticDatabase,
  };
};

// Keyword + fuzzy
export const createKeywordDatabase = async (
  corpus: Corpus,
) => {
  console.info('Creating Keyword Database');

  const documents: any[] = [];
  const texts = await chunkCorpus(corpus);

  let id = 1;

  for (const [title, chunks] of Object.entries(texts)) {
    for (const chunk of chunks) {
      documents.push({
        id,
        title,
        text: chunk,
      });

      id++;
    }
  }

  const miniSearch = new MiniSearch({
    fields: ['title', 'text'],
    searchOptions: {
      fuzzy: 0.1,
    },
    storeFields: ['title', 'text'],
  });

  miniSearch.addAll(documents);

  console.info('Created Keyword Database');

  return miniSearch;
};

export const createSemanticDatabase = async (
  corpus: Corpus,
): Promise<VectorDB> => {
  console.info('Creating Semantic Vector Database');

  const db = new VectorDB();

  const texts = await chunkCorpus(corpus);

  let id = 1;

  const documents = Object.entries(texts);

  for (let i = 0; i < documents.length; i++) {
    const [title, chunks] = documents[i];

    for (let j = 0; j < chunks.length; j++) {
      console.debug('Creating Embedding for',
        title,
        '- Book',
        i + 1,
        'of',
        documents.length,
        '- Chunk',
        j + 1,
        'of',
        chunks.length,
      );

      const chunk = chunks[j];
      const embedding = await getEmbedding(chunk);

      db.add({
        id: id.toString(),
        embedding,
        metadata: {
          text: chunk,
          title,
        },
      });

      id++;
    }

    console.info('Created Semantic Embeddings for', title);
  }

  console.info('Created Semantic Vector Database');

  return db;
};

export const getEmbedding = async (
  text: string,
  model = config.LLM,
): Promise<Embedding> => {
  const res = await ollama.embeddings({
    model,
    prompt: text,
  });

  return res.embedding;
};

// Unfortunately, imvectordb does not expose
// metadata about the vector database
export const getEmbeddingRange = (db: VectorDB) => {
  const s = db.size();

  let ma = -Infinity;
  let mi = Infinity;

  for (let i = 1; i <= s; i++) {
    const d = db.get(i.toString());

    /* eslint-disable @typescript-eslint/no-unsafe-argument */
    ma = Math.max(ma, max(d?.embedding));
    mi = Math.min(mi, min(d?.embedding));
    /* eslint-enable */
  }

  return {
    max: ma,
    min: mi,
  };
};

// Generate a filename from a string
// by removing punctuation and spaces
export const getFilename = (s: string): string => s
  .trim()
  .toLowerCase()
  .replaceAll(/[.,/#!$%^&*;:{}=\-_`~()?]/g, '') // Remove punctuation
  .replaceAll(/\s+/g, '_'); // Remove spaces

export const loadDatabases = async (
  databasePaths?: DatabasePaths,
): Promise<Databases> => {
  const [
    keywordDatabase,
    semanticDatabase,
  ] = await Promise.all([
    loadKeywordDatabase(databasePaths?.keywordDatabasePath),
    loadSemanticDatabase(databasePaths?.semanticDatabasePath),
  ]);

  return {
    keywordDatabase,
    semanticDatabase,
  };
};

export const loadKeywordDatabase = async (
  keywordDatabasePath?: string,
): Promise<MiniSearch> => {
  const filepath = keywordDatabasePath ?? `${getFilename(config.LLM as string)}-keyword-database.json`;
  const file = fs.readFileSync(filepath, 'utf8');

  return MiniSearch.loadJSON(file, {
    fields: ['title', 'text'],
    searchOptions: {
      fuzzy: 0.1,
    },
    storeFields: ['title', 'text'],
  });
};

export const loadSemanticDatabase = async (
  semanticDatabasePath?: string,
): Promise<VectorDB> => {
  const db = new VectorDB();
  const filepath = semanticDatabasePath ?? `${getFilename(config.LLM as string)}-semantic-vector.db`;

  await db.loadFile(filepath);

  return db;
};

export const readFiles = async (
  globpath: string,
): Promise<Corpus> => {
  const corpus: Corpus = {};

  const filepaths = globSync(globpath);

  for (const filepath of filepaths) {
    const title = path.basename(filepath)
      .split('.')[0]; // Strip folger suffix
    const file = fs.readFileSync(filepath, 'utf8');

    corpus[title] = file;
  }

  return corpus;
};

export type DatabasePaths = {
  keywordDatabasePath: string;
  semanticDatabasePath: string;
};
export const saveDatabases = async (
  databases: Databases,
  databasePaths?: DatabasePaths,
): Promise<void> => {
  await Promise.all([
    saveKeywordDatabase(databases.keywordDatabase, databasePaths?.keywordDatabasePath),
    saveSemanticDatabase(databases.semanticDatabase, databasePaths?.semanticDatabasePath),
  ]);
};

export const saveKeywordDatabase = async (
  keywordDatabase: MiniSearch,
  keywordDatabasePath?: string,
): Promise<void> => {
  const filepath = keywordDatabasePath ?? `${getFilename(config.LLM as string)}-keyword-database.json`;
  const data = JSON.stringify(keywordDatabase);

  try {
    fs.writeFileSync(filepath, data, 'utf8');
  } catch (error) {
    console.error('Unable to save keyword database to', filepath);
    console.error(error);
  }
};

export const saveSemanticDatabase = async (
  semanticDatabase: VectorDB,
  semanticDatabasePath?: string,
): Promise<void> => {
  const filepath = semanticDatabasePath ?? `${getFilename(config.LLM as string)}-semantic-vector.db`;

  try {
    await semanticDatabase.dumpFile(filepath);
  } catch (error) {
    console.error('Unable to save semantic vector database to', filepath);
    console.error(error);
  }
};
