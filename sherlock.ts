/**
 * Rag-based LLM Nodejs script to answer a query
 * about Sherlock Holmes using Ollama LLM
 */
import readline from 'readline';

import { Command } from 'commander';
import { VectorDB } from 'imvectordb';
import ollama, { Message } from 'ollama';

import env from './environment';
import { loadSemanticDatabase } from './utils/etl';
import { semanticSearch } from './utils/search';

const Program = new Command();

export const sherlockChat = async (
  db: VectorDB,
  question: string,
  chatHistory = [] as Message[],
) => {
  const searchRes = await semanticSearch(db, question, 5);

  const query = `
    Prompt: You are a English-speaking British literature teacher, answering questions about Sherlock Holmes. You are known for your wit and accuracy. Answer the user's question using the following documents retrieved from a vector database to provide the answer. 

    Documents:
      ${searchRes.map((r, i) => `${i + 1}. ${r.text}`).join('\n')}

    Question: ${question}

    Expected Answer: Provide an answer to the user's question, but don't mention the documents.
  `;

  const res = await ollama.chat({
    messages: chatHistory.concat([{
      content: query,
      role: 'user',
    }]),
    model: env.LLM,
  });

  return res.message.content.trim();
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});
const prompt = (query) => new Promise(resolve => rl.question(query, resolve));

const interactive = async (
  db: VectorDB,
  greeting: string,
  chatHistory = [] as Message[],
) => {
  const question = await prompt(greeting) as string;

  chatHistory.push({ content: question, role: 'user' });

  const chatRes = await sherlockChat(db, question, chatHistory);

  chatHistory.push({ content: chatRes, role: 'system' });

  const newGreeting = 'What else would you like to know about Sherlock Holmes?';

  return interactive(db, newGreeting, chatHistory);
};

const main = async (question: string) => {
  const opts = Program.opts();

  const db = await loadSemanticDatabase();

  if (opts.chat) {
    const greeting = 'Hello, what would you like to know about Sherlock Holmes?';
    return interactive(db, greeting);
  }

  const chatRes = await sherlockChat(db, question);

  console.info(chatRes);

  process.exit();
};


Program
  .description('Get answers about Sherlock Holmes')
  .option('-c, --chat', 'Chat with a Sherlock Holmes educator')
  .argument('[question]', 'Ask a question about Sherlock Holmes')
  .action(main)
  .parse();
