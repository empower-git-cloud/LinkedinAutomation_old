import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const workspaceState = sqliteTable("workspace_state", {
  id: text("id").primaryKey(),
  payload: text("payload").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const uploadedAssets = sqliteTable("uploaded_assets", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  objectKey: text("object_key").notNull(),
  filename: text("filename").notNull(),
  contentType: text("content_type").notNull(),
  size: integer("size").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const linkedinConnections = sqliteTable("linkedin_connections", {
  workspaceId: text("workspace_id").primaryKey(),
  accessTokenEncrypted: text("access_token_encrypted").notNull(),
  refreshTokenEncrypted: text("refresh_token_encrypted"),
  memberUrn: text("member_urn").notNull(),
  memberName: text("member_name"),
  organizationUrn: text("organization_urn"),
  scopes: text("scopes").notNull(),
  expiresAt: integer("expires_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const oauthStates = sqliteTable("oauth_states", {
  state: text("state").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  expiresAt: integer("expires_at").notNull(),
});

export const users = sqliteTable("users", {
  email: text("email").primaryKey(),
  createdAt: integer("created_at").notNull(),
  lastLoginAt: integer("last_login_at").notNull(),
});
