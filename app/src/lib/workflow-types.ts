export enum WorkflowState {
  NOT_CASTED = 'NOT_CASTED',
  CASTED = 'CASTED',
  CHANCE_ACTIVE = 'CHANCE_ACTIVE',
  CHANCE_EXPIRED = 'CHANCE_EXPIRED',
  MANUAL_SEND = 'MANUAL_SEND',
}

export interface WorkflowData {
  state: WorkflowState;
  winnerSelectionStart?: string | null;
  currentCastHash?: string | null;
}

export const DEFAULT_WORKFLOW_DATA: WorkflowData = {
  state: WorkflowState.NOT_CASTED,
  winnerSelectionStart: null,
  currentCastHash: null,
};
