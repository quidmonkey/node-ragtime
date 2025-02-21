import { VectorDB } from 'imvectordb';
import ollama, { Message } from 'ollama';

import config from '../environment';
import { semanticSearch } from './search';

export const sherlockChat = async (
  db: VectorDB,
  question: string,
  chatHistory = [] as Message[],
  model = config.LLM,
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
  `;

  const res = await ollama.chat({
    messages: chatHistory.concat([{
      content: query.trim(),
      role: 'user',
    }]),
    model,
  });

  return res.message.content.trim();
};
