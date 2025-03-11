/* eslint-disable @typescript-eslint/no-empty-function */

export type LogLevel = "debug" | "info" | "log" | "warn" | "error" | "silent";

export const setLogLevel = (level: LogLevel): void => {
	if (level === "debug") {
		return;
	}

	if (level === "info" || level === "log") {
		console.debug = () => {};
	}

	if (level === "warn") {
		console.debug = () => {};
		console.info = () => {};
		console.log = () => {};
	}

	if (level === "error") {
		console.debug = () => {};
		console.info = () => {};
		console.log = () => {};
		console.warn = () => {};
	}

	if (level === "silent") {
		console.debug = () => {};
		console.info = () => {};
		console.log = () => {};
		console.warn = () => {};
		console.error = () => {};
	}
};
