# ragtime

This project provides a couple examples of RAG using LLMs:
* Sherlock Holmes - A chatbot that can answer questions about Sherlock Holmes using the public domain works of Sir Arthur Conan Doyle.
* Web - A chatbot that can answer questions about anything using a Google search 

## Installation

Install [ollama](https://ollama.com/download)

By default, this project uses a lightweight model. Smaller, targeted LLMs are more useful for domain-specific tasks, and can be run on a laptop CPU. You will need to install the following model:

* LLM - [qwen2.5:1.5b](https://ollama.com/library/qwen2.5:1.5b)

```bash
ollama pull qwen2.5:1.5b
```

This model can be overridden by setting the following environment variable:
```bash
LLM="my-ollama-llm"
```
NOTE: This project supports the use of `.env` files. A `.env` file can be created within the project root.

## Sherlock RAG Example

This project contains a RAG 

### Generating the Corpus

```bash
npx tsx create-sherlock-corpus
```

This script will download all public domain Sherlock Holmes works as `.txt` files and save them to the `documents/` directory in the project root. It will then generate a keyword database (`.json` file) and semantic database (vector `.db` file). Be aware that this script may take several minutes to complete.

### Run
To ask a question:
```bash
npx tsx sherlock "What is Sherlock Holmes's favorite food?"
```

For interactive chat mode:
```bash
npx tsx sherlock --chat
```

## Web RAG Example

This script makes use of a Google Custom Search Engine to search the web for information. You will need to provide your own `GOOGLE_API_KEY` and `GOOGLE_SEARCH_ENGINE_ID` environment variables.

### Run
To ask a question:
```bash
npx tsx web "What is the capital of France?"
```

## Creating Your Own RAG

This project provides an additional script to generate a keyword and semantic database from a document or directory of documents.

```bash
npx tsx create-corpus path/to/documents
```

Currently, only `.txt`, `.md`, and `.pdf` files are supported. Be aware that this script may take several minutes to complete.

Once the databases have been created, you can then create your own chatbot using the `sherlock.ts` script as a template. You will need to ensure that the proper database name is provided to the `loadSemanticDatabase(myDatabaseName)` call within the script.
