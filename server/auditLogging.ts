/**
 * Audit Logging for AI Actions
 * 
 * Logs all AI-related actions for compliance, trust, and accountability:
 * - AI drafts created
 * - AI replies sent (auto-pilot or approved)
 * - User edits to AI content
 * - Manual messages (non-AI)
 * - AI disabled/enabled per lead
 * - Manual takeover events
 */

import { AuthRequest } from "./auth";

export interface AIAuditDetails {
  actionType: "ai_draft_created" | "ai_reply_sent" | "ai_reply_edited" | "manual_message" | "ai_disabled" | "ai_enabled" | "manual_takeover";
  leadId: string;
  leadName?: string;
  conversationId?: string;
  pendingReplyId?: string;
  channel?: string;
  editedByUser?: boolean;
  originalContent?: string;
  finalContent?: string;
  sentViaAutoPilot?: boolean;
  autoPilotReason?: string;
  confidenceLevel?: string;
}

/**
 * Log AI-related actions to audit logs
 */
export async function logAIAction(
  req: AuthRequest,
  details: AIAuditDetails
): Promise<void> {
  try {
    const { db } = await import("./db");
    const { auditLogs } = await import("@shared/schema");
    
    // Build action name
    let action: string;
    switch (details.actionType) {
      case "ai_draft_created":
        action = "ai_draft_created";
        break;
      case "ai_reply_sent":
        action = details.sentViaAutoPilot ? "ai_reply_auto_sent" : "ai_reply_sent";
        break;
      case "ai_reply_edited":
        action = "ai_reply_edited";
        break;
      case "manual_message":
        action = "manual_message_sent";
        break;
      case "ai_disabled":
        action = "ai_disabled_for_lead";
        break;
      case "ai_enabled":
        action = "ai_enabled_for_lead";
        break;
      case "manual_takeover":
        action = "manual_takeover";
        break;
      default:
        action = "ai_action";
    }
    
    // Build audit details
    const auditDetails: any = {
      actionType: details.actionType,
      leadId: details.leadId,
      leadName: details.leadName,
      channel: details.channel,
    };
    
    if (details.conversationId) {
      auditDetails.conversationId = details.conversationId;
    }
    
    if (details.pendingReplyId) {
      auditDetails.pendingReplyId = details.pendingReplyId;
    }
    
    if (details.actionType === "ai_reply_edited") {
      auditDetails.editedByUser = details.editedByUser ?? true;
      if (details.originalContent) {
        auditDetails.originalContentLength = details.originalContent.length;
        auditDetails.originalContentPreview = details.originalContent.substring(0, 200);
      }
      if (details.finalContent) {
        auditDetails.finalContentLength = details.finalContent.length;
        auditDetails.finalContentPreview = details.finalContent.substring(0, 200);
      }
    }
    
    if (details.sentViaAutoPilot) {
      auditDetails.sentViaAutoPilot = true;
      auditDetails.autoPilotReason = details.autoPilotReason;
      auditDetails.confidenceLevel = details.confidenceLevel;
    }
    
    await db.insert(auditLogs).values({
      userId: req.user?.id,
      orgId: req.orgId,
      action,
      resource: "conversations",
      resourceId: details.conversationId || details.pendingReplyId || details.leadId,
      allowed: true,
      details: auditDetails,
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers["user-agent"],
    });
  } catch (error) {
    console.error("[Audit Logging] Failed to log AI action:", error);
    // Don't throw - audit logging failure shouldn't break the request
  }
}

/**
 * Log AI action without request context (for background jobs)
 */
export async function logAIActionBackground(
  orgId: string,
  userId: string | null,
  details: AIAuditDetails
): Promise<void> {
  try {
    const { db } = await import("./db");
    const { auditLogs } = await import("@shared/schema");
    
    // Build action name
    let action: string;
    switch (details.actionType) {
      case "ai_draft_created":
        action = "ai_draft_created";
        break;
      case "ai_reply_sent":
        action = details.sentViaAutoPilot ? "ai_reply_auto_sent" : "ai_reply_sent";
        break;
      case "ai_reply_edited":
        action = "ai_reply_edited";
        break;
      case "manual_message":
        action = "manual_message_sent";
        break;
      case "ai_disabled":
        action = "ai_disabled_for_lead";
        break;
      case "ai_enabled":
        action = "ai_enabled_for_lead";
        break;
      case "manual_takeover":
        action = "manual_takeover";
        break;
      default:
        action = "ai_action";
    }
    
    // Build audit details
    const auditDetails: any = {
      actionType: details.actionType,
      leadId: details.leadId,
      leadName: details.leadName,
      channel: details.channel,
    };
    
    if (details.conversationId) {
      auditDetails.conversationId = details.conversationId;
    }
    
    if (details.pendingReplyId) {
      auditDetails.pendingReplyId = details.pendingReplyId;
    }
    
    if (details.sentViaAutoPilot) {
      auditDetails.sentViaAutoPilot = true;
      auditDetails.autoPilotReason = details.autoPilotReason;
      auditDetails.confidenceLevel = details.confidenceLevel;
    }
    
    await db.insert(auditLogs).values({
      userId: userId,
      orgId: orgId,
      action,
      resource: "conversations",
      resourceId: details.conversationId || details.pendingReplyId || details.leadId,
      allowed: true,
      details: auditDetails,
    });
  } catch (error) {
    console.error("[Audit Logging] Failed to log AI action (background):", error);
    // Don't throw - audit logging failure shouldn't break the request
  }
}


