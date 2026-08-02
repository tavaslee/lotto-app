ALTER TABLE `users` ADD `username` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(32);--> statement-breakpoint
ALTER TABLE `users` ADD `notes` text;--> statement-breakpoint
ALTER TABLE `users` ADD `memberLevel` enum('regular','premium') DEFAULT 'regular' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `memberStatus` enum('active','suspended','pending') DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `membershipExpiresAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `useCustomPermissions` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `customPermissions` json;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_username_unique` UNIQUE(`username`);