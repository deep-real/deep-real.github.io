CREATE TABLE `applications` (
	`id` text PRIMARY KEY NOT NULL,
	`request_key` text NOT NULL,
	`fingerprint` text NOT NULL,
	`submitted_at` text NOT NULL,
	`position` text NOT NULL,
	`record_json` text NOT NULL,
	`csv_row` text NOT NULL,
	`files_json` text NOT NULL,
	`delivery_status` text NOT NULL,
	`delivery_http_status` integer,
	`delivery_error` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `applications_request_key_unique` ON `applications` (`request_key`);
