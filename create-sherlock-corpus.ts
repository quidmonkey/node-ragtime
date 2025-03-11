/**
 * Generate a vector database of embeddings using the publicly available
 * Sherlock Holmes corpus and wikipedia
 */
import fs from "node:fs";

import axios from "axios";
import { Command } from "commander";
import { sync as globSync } from "glob";
import { JSDOM } from "jsdom";
import wiki from "wikipedia";

import {
  type Corpus,
  batchCreateDatabases,
  createDatabases,
  readFiles,
  saveDatabases,
} from "./utils/etl";

const DocumentsDir = "documents";
// prevent dupes by ignoring collections (standalone stories only)
const IgnoredCollections = [
  "The Complete Canon",
  "The Adventures of Sherlock Holmes",
  "The Memoirs of Sherlock Holmes",
  "The Return of Sherlock Holmes",
  "His Last Bow",
  "The Case-Book of Sherlock Holmes",
];
const SherlockDomain = "https://sherlock-holm.es";
const SherlockUrl = `${SherlockDomain}/ascii/`;
const WikipediaQueries = ["Sherlock Holmes", "Sir Arthur Conan Doyle"];

interface Document {
  content: string;
  title: string;
  url: string;
}

const createCorpus = async (): Promise<Corpus> => {
  const books = await getBooks();
  const wikiQueries = await getWikiQueries();

  const bookDocuments = await getBookDocuments(books);
  const wikiDocuments = await getWikiDocuments(wikiQueries);

  const tableDocument = getTableOfContents(books);

  const bookCorpus = await getCorpus(bookDocuments);
  const wikiCorpus = await getCorpus(wikiDocuments);

  const corpus = {
    ...bookCorpus,
    ...wikiCorpus,
    [tableDocument.title]: tableDocument.content,
  };

  return corpus;
};

const downloadBook = async (
  book: Pick<Document, "title" | "url">,
): Promise<Document> => {
  const newBook = { ...book, content: "" };

  try {
    const res = await axios.get(book.url);

    newBook.content = res.data as string;
  } catch (err) {
    console.error("Unable to download", book.title, err);
  }

  return newBook;
};

const downloadWikiContent = async (
  wikiQuery: Pick<Document, "title">,
): Promise<Document> => {
  const newWikiQuery = { ...wikiQuery, content: "", url: "" };

  try {
    const page = await wiki.page(wikiQuery.title);

    newWikiQuery.content = await page.content();
    newWikiQuery.url = page.fullurl;
  } catch (err) {
    console.error(
      "Unable to get Wikipedia content for",
      newWikiQuery.title,
      err,
    );
  }

  return newWikiQuery;
};

const getBooks = async (): Promise<Pick<Document, "title" | "url">[]> => {
  // biome-ignore lint/suspicious/noExplicitAny: 3rd party types...
  const res = (await axios.get(SherlockUrl)) as any;
  const dom = new JSDOM(res.data);

  const anchors = Array.from(dom.window.document.getElementsByTagName("a"));

  return anchors
    .filter((anchor) => anchor.href.endsWith(".txt"))
    .filter(
      (anchor) => !IgnoredCollections.includes(anchor.textContent as string),
    )
    .map((anchor) => ({
      title: anchor.textContent as string,
      url: `${SherlockDomain}${anchor.href}`,
    }));
};

const getBookDocuments = async (
  books: Pick<Document, "title" | "url">[],
): Promise<Document[]> => {
  const newBooks: Document[] = [];

  if (!fs.existsSync(DocumentsDir)) {
    fs.mkdirSync(DocumentsDir, { recursive: true });
  }

  for (const book of books) {
    const filename = getFilename(book);
    const filepath = `${DocumentsDir}/${filename}`;

    let newBook: Document;

    if (fs.existsSync(filepath)) {
      newBook = {
        content: fs.readFileSync(filepath, "utf-8"),
        title: book.title,
        url: book.url,
      };

      console.info("Read", newBook.title, "from", filepath);
    } else {
      newBook = await downloadBook(book);

      if (newBook.content) {
        fs.writeFileSync(filepath, newBook.content);

        console.info(`Downloaded ${newBook.title} to ${filepath}`);
      }
    }

    newBooks.push(newBook);
  }

  return newBooks;
};

const getCorpus = async (documents: Document[]): Promise<Corpus> => {
  console.debug("Found Corpus of", documents.length);

  return documents.reduce((corpus, document) => {
    corpus[document.title] = document.content;
    return corpus;
  }, {});
};

const getFilename = (
  document: Pick<Document, "title" | "url">,
  delimiter = "____",
): string => {
  const [protocol, location] = document.url.split("://");
  const formattedLocation = location.replace(/\//g, delimiter);
  const formattedUrl = `${protocol}${delimiter}${formattedLocation}`;

  return `${document.title}${delimiter}${formattedUrl}`;
};

const getTableOfContents = (
  books: Pick<Document, "title" | "url">[],
): Document => {
  const table = books.map((book, i) => `${i + 1}. ${book.title}`).join("\n");
  const content = `
    Sherlock Holmes Books Written by Sir Arthur Conan Doyle
      ${table}
  `;

  return {
    content: content.trim(),
    title: "Table of Contents",
    url: "",
  };
};

const getTitleUrl = (
  filename: string,
  delimiter = "____",
): Pick<Document, "title" | "url"> => {
  const [title, protocol, ...formattedLocation] = filename.split(delimiter);
  const location = formattedLocation.join("/");
  const url = `${protocol}://${location}`;

  return { title, url };
};

const getWikiDocuments = async (
  wikiQueries: Pick<Document, "title">[],
): Promise<Document[]> => {
  const newWikiQueries: Document[] = [];

  if (!fs.existsSync(DocumentsDir)) {
    fs.mkdirSync(DocumentsDir, { recursive: true });
  }

  for (const wikiQuery of wikiQueries) {
    const globpath = `${DocumentsDir}/${wikiQuery.title}*.txt`;
    const [cachedpath] = globSync(globpath);
    let newWikiQuery: Document;

    if (cachedpath) {
      const { url } = getTitleUrl(cachedpath);
      newWikiQuery = {
        content: fs.readFileSync(cachedpath, "utf-8"),
        title: wikiQuery.title,
        url,
      };

      console.info("Read", newWikiQuery.title, "from", cachedpath);
    } else {
      newWikiQuery = await downloadWikiContent(wikiQuery);

      if (newWikiQuery.content) {
        const filename = getFilename(newWikiQuery);
        const filepath = `${DocumentsDir}/${filename}.txt`;

        fs.writeFileSync(filepath, newWikiQuery.content);

        console.info(`Downloaded ${newWikiQuery.title} to ${filepath}`);
      }
    }
  }

  return newWikiQueries;
};

const getWikiQueries = async (): Promise<Pick<Document, "title">[]> =>
  WikipediaQueries.map((query) => ({ title: query }));

const Program = new Command();

const main = async () => {
  const opts = Program.opts();

  let corpus: Corpus;
  if (opts.skipDownload) {
    console.info("Skipping download of Sherlock Holmes books");
    corpus = await readFiles(`${DocumentsDir}/*.txt`);
  } else {
    corpus = await createCorpus();
  }

  if (opts.batch) {
    console.info("Batching Database Creation");
  }

  const start = Date.now();

  const databases = opts.batch
    ? await batchCreateDatabases(corpus)
    : await createDatabases(corpus);

  const end = (Date.now() - start) / 1000;

  console.debug("Created Vector Database in", end.toFixed(2), "seconds");

  await saveDatabases(databases);

  process.exit();
};

Program.name("create-sherlock-corpus")
  .description("Create Sherlock Holmes corpus")
  .option(
    "-b, --batch",
    "Batch create vector databases - Use if GPU is available",
  )
  .option("-s, --skip-download", "Skip downloading Sherlock Holmes books")
  .action(main);

Program.parse();
