import { env } from 'process';

import dotenv from 'dotenv';

import { setLogLevel } from './utils/logger';

dotenv.config();

const compareModels = env.COMPARE_MODELS
  ? env.COMPARE_MODELS.split(',')
  : [
      'qwen2.5:0.5b',
      'qwen2.5:1.5b',
      'qwen2.5:7b',
    ];
const llm = env.LLM ?? 'qwen2.5:1.5b';
const defaults = {
  COMPARE_MODELS: compareModels,
  // EMBEDDING_CHUNK_SIZE: 1536,
  EMBEDDING_CHUNK_SIZE: 512,
  EMBEDDING_OVERLAP_SIZE: 20,
  LLM: llm,
  LOG_LEVEL: 'info',
  KEYWORD_DATABASE: `${llm}-keyword-database.json`,
  SEMANTIC_DATABASE: `${llm}-semantic-vector.db`,
};
const config: any = Object.entries(defaults)
  .reduce(
    (hash, [key, value]) => ({
      ...hash,
      [key]: env[key] as string ?? value,
    }),
    {}
  );

setLogLevel(config.LOG_LEVEL);

console.debug('🔍 Config', config);

export default config;
