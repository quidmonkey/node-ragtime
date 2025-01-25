/**
 * Simple Nodejs script to answer a query using 
 * Google Custom Search API and an Ollama LLM
 */
import fs from 'fs';
import process from 'process';

import axios from 'axios';
import * as cheerio from 'cheerio';
import { google } from 'googleapis';
import ollama from 'ollama';

import env from './environment';

const CustomSearch = google.customsearch('v1');
const DocumentsDir = '../documents';

const answerQuery = async (query: string, texts: string[]): Promise<void> => {
  const results = texts
    .map((text, i) => `${i + 1}. ${text}`)
    .join('\n\n');
  const res = await ollama.generate({
    model: env.LLM,
    options: {
      num_ctx: 8196,
    },
    prompt: `
      You are an AI assistant tasked with answering user questions accurately using the provided internet search results. Carefully review the search results and compose a concise and well-informed response.

      Question: ${query}

      Internet Search Results:
        ${results}
    `.trim(),
    stream: true,
  });

  for await (const chunk of res) {
    process.stdout.write(chunk.response);

    if (chunk.done) {
      break;
    }
  }
};

const getFilename = (s: string): string => s
  .trim()
  .toLowerCase()
  .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()\?]/g, '')  // remove punctuation
  .replace(/\s+/g, '_');  // remove spaces

const getTexts = async (urls: string[]): Promise<string[]> => {
  const texts: string[] = [];

  for (const url of urls) {
    try {
      const filename = getFilename(url);

      let text;
      if (fs.existsSync(`${DocumentsDir}/${filename}.txt`)) {
        console.debug('Using cached results for', url);
        text = fs.readFileSync(`${DocumentsDir}/${filename}.txt`, 'utf8');
      } else {
        const res = await axios.get(url);
        text = htmlToText(res.data);
        fs.writeFileSync(`${DocumentsDir}/${filename}.txt`, text);
      }

      texts.push(`Source: ${url}\n\n${text}`);
    } catch(err) {
      console.error('Unable to download', url);
    }
  }

  return texts;
};

// taken from https://youtu.be/GMlSFIp1na0?feature=shared&t=399
const htmlToText = (html: string): string => {
  const $ = cheerio.load(html);

  $('script, source, style, head, img, svg, a, form, link, iframe').remove();
  $('*').removeClass();
  $('*').each((_, el) => {
    if (['tag', 'script', 'style'].includes(el.type)) {
      // @ts-ignore
      const attrs = el.attribs ?? {};
      for (const attr of Object.keys(attrs)) {
        if(attr.startsWith("data-")) {
          $(el).removeAttr(attr);
        }
      }
    }
  });

  const text = $('body').text().replace(/\s+/g, ' ').trim();

  return text;
};

const search = async (query, count = 10) => {
  const filename = getFilename(query);

  if (fs.existsSync(`${DocumentsDir}/${filename}.json`)) {
    console.debug('Using cached results for', query);
    const filestring = fs.readFileSync(`${DocumentsDir}/${filename}.json`, 'utf8');
    return JSON.parse(filestring);
  }

  const res = await CustomSearch.cse.list({
    q: query,
    cx: process.env.GOOGLE_SEARCH_ENGINE_ID ?? 'd20d7b21d74d44102',
    auth: process.env.GOOGLE_API_KEY,
    num: count
  });

  const items = res.data.items?.map(({ link, snippet, title }) => ({
    link,
    snippet,
    title
  }));

  fs.writeFileSync(`${DocumentsDir}/${filename}.json`, JSON.stringify(items));

  return items;
}

const main = async (query: string) => {
  console.log(`Query: ${query}`);
  console.log('');

  if (!fs.existsSync(DocumentsDir)) {
    console.debug('Creating documents cache directory');
    fs.mkdirSync(DocumentsDir);
  }

  const searchRes = await search(query);
  const urls = searchRes
    .map(({ link }) => link)
    .filter((url) => {
      const IgnoredDomains = [
        'quora.com',
        'reddit.com'
      ];

      for (const domain of IgnoredDomains) {
        if (url.includes(domain)) {
          return false;
        }
      }

      return true;
    });
    
  const texts = await getTexts(urls);

  await answerQuery(query, texts);
}

main('Who is the villain in the movie The Dark Knight?');
