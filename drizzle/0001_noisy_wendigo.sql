CREATE TABLE `linkedin_connections` (
	`workspace_id` text PRIMARY KEY NOT NULL,
	`access_token_encrypted` text NOT NULL,
	`refresh_token_encrypted` text,
	`member_urn` text NOT NULL,
	`member_name` text,
	`organization_urn` text,
	`scopes` text NOT NULL,
	`expires_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `oauth_states` (
	`state` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`expires_at` integer NOT NULL
);
