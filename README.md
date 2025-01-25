# ragtime

## Installation

Install [ollama](https://ollama.com/download)

By default, this project uses a lightweight model. Smaller, more targeted LLM are more useful for domain-specific tasks, and can be run on a laptop CPU. The following model is used by default:

* LLM - [qwen2.5:0.5b](https://ollama.com/library/qwen2.5:0.5b)

This model can be overridden by setting the following environment variable:
```bash
LLM="my-ollama-llm"
```
NOTE: This project supports the use of `.env` files. A `.env` file can be created within the project root.

### LLMs

[gemma2:2b](https://ollama.com/library/gemma2:2b)
[all-minilm:22b](https://ollama.com/library/all-minilm)

## Generating the Corpus

```bash
npx tsx create-sherlock-corpus
```

This script will download all public domain Sherlock Holmes works as `.txt` files and save them to the `documents/` directory in the project root. It will then generate a keyword database (`.json` file) and semantic database (vector `.db` file).

```bash
npx tsx create-sherlock-corpus -h
```

## Run
```bash
npx tsx index.ts
```
