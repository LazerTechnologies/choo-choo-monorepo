import pino from 'pino';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogPayload = Record<string, unknown> & { msg?: string };

const baseLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
    bindings: () => ({}),
  },
  base: {
    env: process.env.NODE_ENV,
  },
  // Reduce log output in production to prevent rate limiting
  ...(process.env.NODE_ENV === 'production' && {
    redact: {
      paths: ['hostname', 'pid'],
      remove: true,
    },
  }),
});

export const logger = baseLogger;

interface StructuredLogger<Code extends string> {
  debug: (code: Code, payload?: LogPayload) => void;
  info: (code: Code, payload?: LogPayload) => void;
  warn: (code: Code, payload?: LogPayload) => void;
  error: (code: Code, payload?: LogPayload) => void;
}

function createDomainLogger<Code extends string>(domain: string): StructuredLogger<Code> {
  const child = baseLogger.child({ domain });

  const log = (level: LogLevel, code: Code, payload: LogPayload = {}) => {
    const entry = {
      code: `${domain}.${code}`,
      ...payload,
    };

    switch (level) {
      case 'debug':
        child.debug(entry);
        break;
      case 'info':
        child.info(entry);
        break;
      case 'warn':
        child.warn(entry);
        break;
      case 'error':
        child.error(entry);
        break;
    }
  };

  return {
    debug: (code, payload) => log('debug', code, payload),
    info: (code, payload) => log('info', code, payload),
    warn: (code, payload) => log('warn', code, payload),
    error: (code, payload) => log('error', code, payload),
  };
}

export type OrchestratorOperation =
  | 'send-train'
  | 'random-send'
  | 'manual-send'
  | 'yoink'
  | 'admin-send';

export type OrchestratorEvent =
  | 'start'
  | 'staging_created'
  | 'staging_updated'
  | 'promotion_store_success'
  | 'promotion_success'
  | 'promotion_failed'
  | 'abandon_failed'
  | 'completed'
  | 'failed'
  | 'contract_submitted'
  | 'contract_confirmed'
  | 'metadata_set'
  | 'recovered'
  | 'post_commit_warning';

export type OrchestratorLogCode = `${OrchestratorOperation}.${OrchestratorEvent}`;

export function toOrchestratorLogCode(
  operation: OrchestratorOperation,
  event: OrchestratorEvent,
): OrchestratorLogCode {
  return `${operation}.${event}` as OrchestratorLogCode;
}

type StagingCategory = 'lifecycle' | 'promotion' | 'validation' | 'listing' | 'health_check';
type StagingEvent =
  | 'exists'
  | 'created'
  | 'updated'
  | 'abandoned'
  | 'success'
  | 'failed'
  | 'parse_failed'
  | 'conflict'
  | 'conflict_exhausted'
  | 'update_failed';
export type StagingLogCode = `${StagingCategory}.${StagingEvent}`;

type RedisAction = 'set' | 'get' | 'del' | 'publish' | 'lock';
type RedisEvent = 'attempt' | 'success' | 'failed' | 'skipped';
export type RedisLogCode = `${RedisAction}.${RedisEvent}`;

export function toRedisLogCode(action: RedisAction, event: RedisEvent): RedisLogCode {
  return `${action}.${event}` as RedisLogCode;
}

type ContractOperation =
  | 'next-stop'
  | 'yoink'
  | 'set-ticket-data'
  | 'verify'
  | 'read'
  | 'gas-estimate'
  | 'nonce-retry'
  | 'tx-mined'
  | 'tx-reverted'
  | 'deposit-check';
type ContractEvent = 'attempt' | 'success' | 'failed' | 'warning' | 'info';
export type ContractLogCode = `${ContractOperation}.${ContractEvent}`;

type RetrySubject = 'operation' | 'backoff';
type RetryEvent = 'attempt' | 'success' | 'failed' | 'scheduled' | 'exhausted';
export type RetryLogCode = `${RetrySubject}.${RetryEvent}`;

export function toRetryLogCode(subject: RetrySubject, event: RetryEvent): RetryLogCode {
  return `${subject}.${event}` as RetryLogCode;
}

type ApiEndpoint =
  | 'users-address'
  | 'mint-token'
  | 'set-ticket-data'
  | 'admin-set-ticket-data'
  | 'scheduler-status'
  | 'init-scheduler'
  | 'webhook'
  | 'cast-status'
  | 'admin-recover-failed-mint'
  | 'admin-repair-corrupted-tokens'
  | 'journey'
  | 'yoink'
  | 'check-banned';
type ApiEvent =
  | 'request'
  | 'neynar_call'
  | 'neynar_response'
  | 'success'
  | 'failed'
  | 'not_found'
  | 'invalid_fid'
  | 'missing_config'
  | 'missing_fid'
  | 'no_address'
  | 'unauthorized'
  | 'validation_failed'
  | 'parse_failed'
  | 'token_exists'
  | 'contract_executed'
  | 'verification_skipped'
  | 'received'
  | 'signature_validated'
  | 'signature_invalid'
  | 'cast_processed'
  | 'cast_ignored'
  | 'cast_found'
  | 'cast_not_found'
  | 'workflow_updated'
  | 'api_fallback';
export type ApiLogCode = `${ApiEndpoint}.${ApiEvent}`;

type RedisConnectionEvent =
  | 'connect'
  | 'ready'
  | 'error'
  | 'close'
  | 'reconnecting'
  | 'retry'
  | 'max_retries_exceeded'
  | 'subscription_connected'
  | 'subscription_ready'
  | 'subscription_error';
export type RedisConnectionLogCode = `connection.${RedisConnectionEvent}`;

type SchedulerEvent =
  | 'initialized'
  | 'already_initialized'
  | 'job_scheduled'
  | 'job_started'
  | 'job_completed'
  | 'job_failed'
  | 'shutdown'
  | 'job_stopped'
  | 'yoink_check_notification_sent'
  | 'yoink_check_already_sent'
  | 'yoink_check_not_available';
export type SchedulerLogCode = `scheduler.${SchedulerEvent}`;

// Helper function to create scheduler log codes (domain logger prepends 'scheduler.')
export function toSchedulerLogCode(event: SchedulerEvent): SchedulerLogCode {
  return `scheduler.${event}` as SchedulerLogCode;
}

type AuthCategory = 'banned-user' | 'admin' | 'frame-admin' | 'session-admin';
type AuthEvent = 'check' | 'blocked' | 'allowed' | 'failed' | 'missing_fid';
export type AuthLogCode = `${AuthCategory}.${AuthEvent}`;

export const orchestratorLog = createDomainLogger<OrchestratorLogCode>('orchestrator');
export const stagingLog = createDomainLogger<StagingLogCode>('staging');
export const redisLog = createDomainLogger<RedisLogCode>('redis');
export const redisConnectionLog = createDomainLogger<RedisConnectionLogCode>('redis');
export const contractLog = createDomainLogger<ContractLogCode>('contract');
export const retryLog = createDomainLogger<RetryLogCode>('retry');
export const apiLog = createDomainLogger<ApiLogCode>('api');
export const schedulerLog = createDomainLogger<SchedulerLogCode>('scheduler');
export const authLog = createDomainLogger<AuthLogCode>('auth');
