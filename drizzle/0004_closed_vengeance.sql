ALTER TABLE `bookings` MODIFY COLUMN `addressLine1` varchar(255);--> statement-breakpoint
ALTER TABLE `bookings` MODIFY COLUMN `city` varchar(120);--> statement-breakpoint
ALTER TABLE `bookings` MODIFY COLUMN `postcode` varchar(40);--> statement-breakpoint
ALTER TABLE `bookings` MODIFY COLUMN `updatedAt` timestamp NOT NULL DEFAULT (now());--> statement-breakpoint
ALTER TABLE `orders` MODIFY COLUMN `addressLine1` varchar(255);--> statement-breakpoint
ALTER TABLE `orders` MODIFY COLUMN `city` varchar(120);--> statement-breakpoint
ALTER TABLE `orders` MODIFY COLUMN `postcode` varchar(40);--> statement-breakpoint
ALTER TABLE `orders` MODIFY COLUMN `updatedAt` timestamp NOT NULL DEFAULT (now());--> statement-breakpoint
ALTER TABLE `products` MODIFY COLUMN `updatedAt` timestamp NOT NULL DEFAULT (now());--> statement-breakpoint
ALTER TABLE `reviews` MODIFY COLUMN `updatedAt` timestamp NOT NULL DEFAULT (now());--> statement-breakpoint
ALTER TABLE `services` MODIFY COLUMN `category` enum('Braids','Twists','Locs','Kids Styles','Men Styles','Add-ons') NOT NULL;--> statement-breakpoint
ALTER TABLE `services` MODIFY COLUMN `updatedAt` timestamp NOT NULL DEFAULT (now());--> statement-breakpoint
ALTER TABLE `tryOnGenerations` MODIFY COLUMN `updatedAt` timestamp NOT NULL DEFAULT (now());--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `updatedAt` timestamp NOT NULL DEFAULT (now());--> statement-breakpoint
ALTER TABLE `websiteSections` MODIFY COLUMN `updatedAt` timestamp NOT NULL DEFAULT (now());--> statement-breakpoint
ALTER TABLE `bookings` ADD `serviceLocation` enum('studio','home_service') DEFAULT 'studio' NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `addressLine2` varchar(255);--> statement-breakpoint
ALTER TABLE `bookings` ADD `homeServiceSurcharge` decimal(10,2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `serviceLocation` enum('studio','home_service') DEFAULT 'studio' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `addressLine2` varchar(255);