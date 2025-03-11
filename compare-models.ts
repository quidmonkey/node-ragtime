/**
 * Rag-based LLM Nodejs script that compares the performance of different LLMs
 * by using Ollama LLM to answer a query about Sherlock Holmes
 */
import config from "./environment";

import { getFilename, loadSemanticDatabase } from "./utils/etl";
import { sherlockChat } from "./utils/sherlock";

const main = async () => {
  const queries = [
    "What is Sherlock's favorite food?",
    "What does Sherlock like to wear?",
    "How many Sherlock Holmes stories are there?",
    "Who wrote Sherlock Holmes?",
    "Who is Sherlock's arch-enemy?",
  ];

  for (const model of config.COMPARE_MODELS) {
    const databasePath = `${getFilename(model)}-semantic-vector.db`;
    const db = await loadSemanticDatabase(databasePath);

    console.log("");
    console.log("### Comparing Model", model, "###");

    for (const query of queries) {
      console.log("");
      console.log("🤔", query);
      console.log("");

      const res = await sherlockChat(db, query);

      console.log("🤖", res);
    }
  }

  process.exit();
};

main();
