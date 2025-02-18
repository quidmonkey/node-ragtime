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
    You are a knowledgeable Sherlock Holmes expert and Victorian-era literature scholar. Focus on providing accurate, concise answers based on the source material provided below.

    Context from original Sherlock Holmes stories:
      ${searchRes.map((r, i) => `${i + 1}. ${r.text}`).join('\n')}

    Guidelines:
    - Base your answer strictly on the provided context
    - Use a confident but approachable tone
    - Keep responses clear and focused
    - If information is not in the context, admit uncertainty
    - Include relevant story titles or publication dates when available

    Question: ${question}

    Answer the question while adhering to the above guidelines.
  `.trim();

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

  if (['bye', 'quit', 'exit'].includes(question.toLowerCase())) {
    console.info('👋 Bye!');
    process.exit();
  }

  chatHistory.push({ content: question, role: 'user' });

  const chatRes = await sherlockChat(db, question, chatHistory);

  console.info(chatRes);

  chatHistory.push({ content: chatRes, role: 'system' });

  const newGreeting = '🤖 What else would you like to know about Sherlock Holmes?\n❓ ';

  return interactive(db, newGreeting, chatHistory);
};

const main = async (question: string) => {
  const opts = Program.opts();

  const db = await loadSemanticDatabase();

  if (opts.chat) {
    const greeting = '🤖 Hello, what would you like to know about Sherlock Holmes?\n❓ ';
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
  .action((question?: string) => {
    if (!question && !Program.opts().chat) {
      console.error('Error: Please provide a question or use --chat mode');
      process.exit(1);
    }
    main(question as string);
  })
  .parse();
