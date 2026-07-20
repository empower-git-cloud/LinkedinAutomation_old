CREATE TABLE `uploaded_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`object_key` text NOT NULL,
	`filename` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workspace_state` (
	`id` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`updated_at` integer NOT NULL
);
