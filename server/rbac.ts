import { Request, Response, NextFunction } from "express";
import type { Membership } from "@shared/schema";

// Define permissions for each role
export const ROLE_PERMISSIONS = {
  admin: {
    // Full access to everything
    users: ["read", "create", "update", "delete"],
    properties: ["read", "create", "update", "delete"],
    leads: ["read", "create", "update", "delete"],
    conversations: ["read", "create"],
    showings: ["read", "create", "update", "delete"],
    analytics: ["read"],
    invitations: ["read", "create", "delete"],
    settings: ["read", "update"],
    audit: ["read"],
  },
  property_manager: {
    // Manage assigned properties
    users: ["read"],
    properties: ["read"], // Can only read properties they're assigned to
    leads: ["read", "create", "update"], // For assigned properties
    conversations: ["read", "create"],
    showings: ["read", "create", "update", "delete"],
    analytics: ["read"], // Property-level only
    invitations: ["read", "create"], // Can invite leasing agents
    settings: [],
    audit: [],
  },
  leasing_agent: {
    // Work with leads for assigned properties
    users: ["read"],
    properties: ["read"], // View only assigned properties
    leads: ["read", "update"], // For assigned properties
    conversations: ["read", "create"],
    showings: ["read", "create", "update"],
    analytics: [], // Personal performance only
    invitations: [],
    settings: [],
    audit: [],
  },
  owner_portal: {
    // Read-only access to properties and analytics
    users: ["read"],
    properties: ["read"], // View only
    leads: [], // No access
    conversations: [],
    showings: [],
    analytics: ["read"], // Financial reports only
    invitations: [],
    settings: [],
    audit: [],
  },
} as const;

export type Role = keyof typeof ROLE_PERMISSIONS;
export type Resource = keyof typeof ROLE_PERMISSIONS.admin;
export type Permission = "read" | "create" | "update" | "delete";

// Check if a role has a specific permission for a resource
export function hasPermission(
  role: Role,
  resource: Resource,
  permission: Permission
): boolean {
  const rolePermissions = ROLE_PERMISSIONS[role];
  if (!rolePermissions) return false;
  
  const resourcePermissions = rolePermissions[resource];
  if (!resourcePermissions) return false;
  
  return resourcePermissions.includes(permission);
}

// Extended Express Request with user and membership info
export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    isAdmin: boolean;
    currentOrgId?: string;
  };
  orgId?: string;
  membership?: Membership;
}

// Middleware to check if user has required permission
export function requirePermission(resource: Resource, permission: Permission) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // Check if user is authenticated
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Get user's membership and role
      const membership = req.membership;
      if (!membership) {
        return res.status(403).json({ error: "No organization membership found" });
      }

      const role = membership.role as Role;

      // Check if role has the required permission
      if (!hasPermission(role, resource, permission)) {
        // Log denied access
        await logAuditAction(
          req,
          resource,
          permission,
          null,
          false,
          `Permission denied: ${role} cannot ${permission} ${resource}`
        );
        
        return res.status(403).json({ 
          error: "Forbidden",
          message: `Your role (${role}) does not have permission to ${permission} ${resource}` 
        });
      }

      next();
    } catch (error) {
      console.error("Permission check error:", error);
      res.status(500).json({ error: "Permission check failed" });
    }
  };
}

// Middleware to check if user can access a specific property
export function requirePropertyAccess() {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const membership = req.membership;
      if (!membership) {
        return res.status(403).json({ error: "No organization membership found" });
      }

      const role = membership.role as Role;

      // Admins have access to all properties
      if (role === "admin") {
        return next();
      }

      // Property managers and leasing agents need to be assigned to the property
      if (role === "property_manager" || role === "leasing_agent") {
        const propertyId = req.params.propertyId || req.body.propertyId;
        
        if (!propertyId) {
          return res.status(400).json({ error: "Property ID required" });
        }

        // Check if user is assigned to this property
        // This will be implemented in storage layer
        const hasAccess = await checkPropertyAssignment(req.user!.id, propertyId);
        
        if (!hasAccess) {
          await logAuditAction(
            req,
            "properties",
            "read",
            propertyId,
            false,
            "Not assigned to this property"
          );
          
          return res.status(403).json({ 
            error: "You don't have access to this property" 
          });
        }
      }

      next();
    } catch (error) {
      console.error("Property access check error:", error);
      res.status(500).json({ error: "Access check failed" });
    }
  };
}

// Helper to log audit actions
export async function logAuditAction(
  req: AuthRequest,
  resource: string,
  action: string,
  resourceId: string | null,
  allowed: boolean,
  details?: string
) {
  try {
    const { db } = await import("./db");
    const { auditLogs } = await import("@shared/schema");
    
    await db.insert(auditLogs).values({
      userId: req.user?.id,
      orgId: req.orgId,
      action,
      resource,
      resourceId,
      allowed,
      details: details ? { message: details } : null,
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers["user-agent"],
    });
  } catch (error) {
    console.error("Failed to log audit action:", error);
    // Don't throw - audit logging failure shouldn't break the request
  }
}

// Placeholder for checking property assignment (will be implemented in storage)
async function checkPropertyAssignment(userId: string, propertyId: string): Promise<boolean> {
  try {
    const { db } = await import("./db");
    const { propertyAssignments } = await import("@shared/schema");
    const { eq, and } = await import("drizzle-orm");
    
    const assignment = await db
      .select()
      .from(propertyAssignments)
      .where(
        and(
          eq(propertyAssignments.userId, userId),
          eq(propertyAssignments.propertyId, propertyId)
        )
      )
      .limit(1);
    
    return assignment.length > 0;
  } catch (error) {
    console.error("Error checking property assignment:", error);
    return false;
  }
}

// Helper to check if user is admin
export function isAdmin(req: AuthRequest): boolean {
  return req.membership?.role === "admin";
}

// Helper to check if user is property manager or admin
export function isPropertyManagerOrAdmin(req: AuthRequest): boolean {
  const role = req.membership?.role;
  return role === "admin" || role === "property_manager";
}
