import pino from "pino";

type LogLevel = "debug" | "info" | "warn" | "error";
type LogPayload = Record<string, unknown> & { msg?: string };

const baseLogger = pino({
	level: process.env.LOG_LEVEL || "info",
	formatters: {
		level: (label) => ({ level: label }),
		bindings: () => ({}),
	},
	base: {
		env: process.env.NODE_ENV,
	},
});

export const logger = baseLogger;

interface StructuredLogger<Code extends string> {
	debug: (code: Code, payload?: LogPayload) => void;
	info: (code: Code, payload?: LogPayload) => void;
	warn: (code: Code, payload?: LogPayload) => void;
	error: (code: Code, payload?: LogPayload) => void;
}

function createDomainLogger<Code extends string>(
	domain: string,
): StructuredLogger<Code> {
	const child = baseLogger.child({ domain });

	const log = (level: LogLevel, code: Code, payload: LogPayload = {}) => {
		const entry = {
			code: `${domain}.${code}`,
			...payload,
		};

		switch (level) {
			case "debug":
				child.debug(entry);
				break;
			case "info":
				child.info(entry);
				break;
			case "warn":
				child.warn(entry);
				break;
			case "error":
				child.error(entry);
				break;
		}
	};

	return {
		debug: (code, payload) => log("debug", code, payload),
		info: (code, payload) => log("info", code, payload),
		warn: (code, payload) => log("warn", code, payload),
		error: (code, payload) => log("error", code, payload),
	};
}

export type OrchestratorOperation =
	| "send-train"
	| "random-send"
	| "manual-send"
	| "yoink"
	| "admin-send";

export type OrchestratorEvent =
	| "start"
	| "staging_created"
	| "staging_updated"
	| "promotion_store_success"
	| "promotion_success"
	| "promotion_failed"
	| "abandon_failed"
	| "completed"
	| "failed"
	| "contract_submitted"
	| "contract_confirmed"
	| "metadata_set"
	| "recovered"
	| "post_commit_warning";

export type OrchestratorLogCode =
	`${OrchestratorOperation}.${OrchestratorEvent}`;

export function toOrchestratorLogCode(
	operation: OrchestratorOperation,
	event: OrchestratorEvent,
): OrchestratorLogCode {
	return `${operation}.${event}` as OrchestratorLogCode;
}

type StagingCategory =
	| "lifecycle"
	| "promotion"
	| "validation"
	| "listing"
	| "health_check";
type StagingEvent =
	| "exists"
	| "created"
	| "updated"
	| "abandoned"
	| "success"
	| "failed"
	| "parse_failed"
	| "conflict"
	| "conflict_exhausted"
	| "update_failed";
export type StagingLogCode = `${StagingCategory}.${StagingEvent}`;

type RedisAction = "set" | "get" | "del" | "publish" | "lock";
type RedisEvent = "attempt" | "success" | "failed" | "skipped";
export type RedisLogCode = `${RedisAction}.${RedisEvent}`;

export function toRedisLogCode(
	action: RedisAction,
	event: RedisEvent,
): RedisLogCode {
	return `${action}.${event}` as RedisLogCode;
}

type ContractOperation =
	| "next-stop"
	| "yoink"
	| "set-ticket-data"
	| "verify"
	| "read";
type ContractEvent = "attempt" | "success" | "failed";
export type ContractLogCode = `${ContractOperation}.${ContractEvent}`;

type RetrySubject = "operation" | "backoff";
type RetryEvent = "attempt" | "success" | "failed" | "scheduled" | "exhausted";
export type RetryLogCode = `${RetrySubject}.${RetryEvent}`;

export function toRetryLogCode(
	subject: RetrySubject,
	event: RetryEvent,
): RetryLogCode {
	return `${subject}.${event}` as RetryLogCode;
}

export const orchestratorLog =
	createDomainLogger<OrchestratorLogCode>("orchestrator");
export const stagingLog = createDomainLogger<StagingLogCode>("staging");
export const redisLog = createDomainLogger<RedisLogCode>("redis");
export const contractLog = createDomainLogger<ContractLogCode>("contract");
export const retryLog = createDomainLogger<RetryLogCode>("retry");
