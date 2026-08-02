ALTER TABLE `users` DROP INDEX `users_username_unique`;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `username` text;--> statement-breakpoint
ALTER TABLE `users` ADD `usernameHash` varchar(64);--> statement-breakpoint
UPDATE `users` SET `usernameHash` = SHA2(`username`, 256) WHERE `username` IS NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_usernameHash_unique` UNIQUE(`usernameHash`);
