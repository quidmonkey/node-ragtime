/**
 * Rag-based LLM Nodejs script that compares the performance of different LLMs 
 * by using Ollama LLM to answer a query about Sherlock Holmes
 */
import { sync as globSync } from 'glob';

import { VectorDB } from 'imvectordb';

import config from './environment';

import { createSherlockDatabases } from './create-sherlock-corpus';
import { sherlockChat } from './sherlock';

import { getFilename, loadSemanticDatabase } from './utils/etl';


const getSemanticDatabase = async (model: string): Promise<VectorDB> => {
  const databaseName = getFilename(model);
  const databasePaths = globSync(`${databaseName}-*.db`);

  if (databasePaths.length > 0) {
    return loadSemanticDatabase(databasePaths[0]);
  }
  
  const { semanticDatabase } = await createSherlockDatabases();

  return semanticDatabase;
};

const main = async () => {
  const queries = [
    "What is Sherlock's favorite food?",
    "What does Sherlock like to wear?",
    "How many Sherlock Holmes stories are there?",
    "Who wrote Sherlock Holmes?",
    "Who is Sherlock's arch-enemy?",
  ];

  for (const model of config.COMPARE_MODELS) {
    const db = await getSemanticDatabase(model);

    console.log('');
    console.log('### Comparing Model', model, '###');

    for (const query of queries) {
      console.log('');
      console.log('🤔', query);
      console.log('');

      const res = await sherlockChat(db, query);

      console.log('🤖', res);
    }
  }

  process.exit();
};

main();
