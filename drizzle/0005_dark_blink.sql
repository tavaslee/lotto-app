CREATE TABLE `carouselSettings` (
	`id` int NOT NULL,
	`isVisible` boolean NOT NULL DEFAULT false,
	`autoplay` boolean NOT NULL DEFAULT true,
	`intervalMs` int NOT NULL DEFAULT 1000,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `carouselSettings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `carouselSlides` (
	`id` int AUTO_INCREMENT NOT NULL,
	`url` text NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`mimeType` varchar(64) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT false,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `carouselSlides_id` PRIMARY KEY(`id`)
);
