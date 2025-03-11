/**
 * Rag-based LLM Nodejs script to answer a query
 * about Sherlock Holmes using Ollama LLM
 */
import readline from "node:readline";

import { Command } from "commander";
import type { VectorDB } from "imvectordb";
import type { Message } from "ollama";

import { loadSemanticDatabase } from "./utils/etl";
import { sherlockChat } from "./utils/sherlock";

const Program = new Command();

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});
const prompt = (query) => new Promise((resolve) => rl.question(query, resolve));

const interactive = async (
	db: VectorDB,
	greeting: string,
	chatHistory = [] as Message[],
) => {
	const question = (await prompt(greeting)) as string;

	if (["bye", "quit", "exit"].includes(question.toLowerCase())) {
		console.info("👋 Bye!");
		process.exit();
	}

	chatHistory.push({ content: question, role: "user" });

	const chatRes = await sherlockChat(db, question, chatHistory);

	console.info(chatRes);

	chatHistory.push({ content: chatRes, role: "system" });

	const newGreeting =
		"🤖 What else would you like to know about Sherlock Holmes?\n❓ ";

	return interactive(db, newGreeting, chatHistory);
};

const main = async (question: string) => {
	const opts = Program.opts();

	const db = await loadSemanticDatabase();

	if (opts.chat) {
		const greeting =
			"🤖 Hello, what would you like to know about Sherlock Holmes?\n❓ ";
		return interactive(db, greeting);
	}

	const chatRes = await sherlockChat(db, question);

	console.info(chatRes);

	process.exit();
};

Program.description("Get answers about Sherlock Holmes")
	.option("-c, --chat", "Chat with a Sherlock Holmes educator")
	.argument("[question]", "Ask a question about Sherlock Holmes")
	.action((question?: string) => {
		if (!question && !Program.opts().chat) {
			console.error("Error: Please provide a question or use --chat mode");
			process.exit(1);
		}
		main(question as string);
	})
	.parse();
