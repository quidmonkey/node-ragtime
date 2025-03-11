import { env } from "node:process";

import dotenv from "dotenv";

import { setLogLevel } from "./utils/logger";

dotenv.config();

const compareModels = env.COMPARE_MODELS
	? env.COMPARE_MODELS.split(",")
	: ["qwen2.5:0.5b", "qwen2.5:1.5b", "qwen2.5:7b"];
const defaults = {
	COMPARE_MODELS: compareModels,
	EMBEDDING_CHUNK_SIZE: 512,
	EMBEDDING_OVERLAP_SIZE: 20,
	LLM: env.LLM ?? "qwen2.5:1.5b",
	LOG_LEVEL: "info",
};
// biome-ignore lint/suspicious/noExplicitAny: env vars are union types
const config: any = Object.entries(defaults).reduce((hash, [key, value]) => {
	hash[key] = (env[key] as string) ?? value;
	return hash;
}, {});

setLogLevel(config.LOG_LEVEL);

console.debug("🔍 Config", config);

export default config;
