export { HttpWondeTransport, WondeClient, WondeApiError } from "./wonde/client";
export type { WondeTransport } from "./wonde/client";
export type { WondeSchool } from "./wonde/types";
export {
  runSync,
  syncStudents,
  syncAttendance,
  syncBehaviour,
  syncAttainment,
  type SyncStats,
} from "./jobs/sync-jobs";
export {
  SYNC_QUEUE_NAME,
  createRedisConnection,
  createSyncQueue,
  createSyncWorker,
  enqueueSync,
  type SyncJobPayload,
} from "./queue";
export {
  RULES_QUEUE_NAME,
  createRulesQueue,
  createRulesWorker,
  enqueueRulesRun,
  fanOutRulesRuns,
  registerNightlyRulesRun,
  type RulesJobPayload,
} from "./rules-queue";
export {
  dispatchSeriousSignalAlerts,
  type DispatchResult,
} from "./notify/dispatch";
export { sendAlertEmail, setAlertSenderForTesting } from "./notify/mailer";
