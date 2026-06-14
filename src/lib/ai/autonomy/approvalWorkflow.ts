import type { ActionProposal } from "../core/schemas";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "modified";

export interface ApprovalRequest {
  id: string;
  action: ActionProposal;
  status: ApprovalStatus;
  requestedAt: string;
  decidedAt?: string;
  userNote?: string;
}

export class ApprovalWorkflow {
  private requests: ApprovalRequest[] = [];

  createRequest(action: ActionProposal): ApprovalRequest {
    const request: ApprovalRequest = {
      id: `approval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      action,
      status: "pending",
      requestedAt: new Date().toISOString(),
    };
    this.requests.push(request);
    return request;
  }

  approve(id: string, userNote?: string): ApprovalRequest | undefined {
    const request = this.requests.find((r) => r.id === id);
    if (request) {
      request.status = "approved";
      request.decidedAt = new Date().toISOString();
      request.userNote = userNote;
    }
    return request;
  }

  reject(id: string, userNote?: string): ApprovalRequest | undefined {
    const request = this.requests.find((r) => r.id === id);
    if (request) {
      request.status = "rejected";
      request.decidedAt = new Date().toISOString();
      request.userNote = userNote;
    }
    return request;
  }

  getPending(): ApprovalRequest[] {
    return this.requests.filter((r) => r.status === "pending");
  }

  getAll(): ApprovalRequest[] {
    return [...this.requests];
  }

  clearExecuted(): void {
    this.requests = this.requests.filter((r) => r.status === "pending");
  }
}

export const globalApprovalWorkflow = new ApprovalWorkflow();
