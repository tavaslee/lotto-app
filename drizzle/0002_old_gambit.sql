ALTER TABLE `users` ADD `memberSyncStatus` enum('pending','synced','failed') DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `memberSyncedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `memberSyncError` text;