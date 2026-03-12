CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`related_themes` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_slug_unique` ON `categories` (`slug`);--> statement-breakpoint
CREATE TABLE `clips` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`video_id` integer NOT NULL,
	`category_id` integer NOT NULL,
	`start_time` real NOT NULL,
	`end_time` real NOT NULL,
	`description` text,
	`quote_snippet` text,
	`relevance_score` real DEFAULT 0,
	`generated_at` text NOT NULL,
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `transcripts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`video_id` integer NOT NULL,
	`language` text NOT NULL,
	`is_generated` integer DEFAULT 0 NOT NULL,
	`word_count` integer DEFAULT 0,
	`full_text` text NOT NULL,
	`entries` text NOT NULL,
	`fetched_at` text NOT NULL,
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transcripts_video_id_unique` ON `transcripts` (`video_id`);--> statement-breakpoint
CREATE TABLE `video_categories` (
	`video_id` integer NOT NULL,
	`category_id` integer NOT NULL,
	`is_primary` integer DEFAULT 0 NOT NULL,
	`relevance_score` real DEFAULT 0,
	PRIMARY KEY(`video_id`, `category_id`),
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `video_key_moments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`video_id` integer NOT NULL,
	`quote_text` text NOT NULL,
	`context` text,
	`start_time` real NOT NULL,
	`end_time` real NOT NULL,
	`generated_at` text NOT NULL,
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `video_summaries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`video_id` integer NOT NULL,
	`summary` text NOT NULL,
	`themes` text,
	`key_quotes` text,
	`tone` text,
	`summarized_at` text NOT NULL,
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `video_summaries_video_id_unique` ON `video_summaries` (`video_id`);