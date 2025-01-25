/**
 * Rag-based LLM Nodejs script that compares the performance of different LLMs 
 * by using Ollama LLM to answer a query about Sherlock Holmes
 */
import config from './environment';

import { loadSemanticDatabase } from './utils/etl';
import { sherlockChat } from './sherlock';

const main = async () => {
  const db = await loadSemanticDatabase();
  const query = 'Who is the best friend of Sherlock Holmes?';

  for (const model of config.COMPARE_MODELS) {
    console.log('');
    console.log('### Comparing Model', model, '###');
    console.log('');
    console.log('🤔', query);
    console.log('');

    const res = await sherlockChat(db, query);

    console.log(res);
  }

  process.exit();
};

main();
