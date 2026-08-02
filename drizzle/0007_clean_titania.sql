CREATE TABLE `siteVisits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`visitorId` varchar(64) NOT NULL,
	`path` varchar(255) NOT NULL,
	`referrerHost` varchar(255),
	`device` enum('desktop','mobile','tablet') NOT NULL,
	`occurredAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `siteVisits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `siteVisits_occurredAt_idx` ON `siteVisits` (`occurredAt`);--> statement-breakpoint
CREATE INDEX `siteVisits_visitor_time_idx` ON `siteVisits` (`visitorId`,`occurredAt`);