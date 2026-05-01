CREATE TABLE `analyticsEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventName` varchar(120) NOT NULL,
	`pagePath` varchar(500) NOT NULL,
	`metadata` json,
	`createdAtMs` bigint NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `analyticsEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serviceId` int,
	`serviceName` varchar(180) NOT NULL,
	`clientName` varchar(180) NOT NULL,
	`clientEmail` varchar(320) NOT NULL,
	`clientPhone` varchar(80) NOT NULL,
	`addressLine1` varchar(255) NOT NULL,
	`city` varchar(120) NOT NULL,
	`county` varchar(120),
	`postcode` varchar(40) NOT NULL,
	`deliveryNote` text,
	`appointmentDate` varchar(20) NOT NULL,
	`appointmentTime` varchar(20) NOT NULL,
	`status` enum('pending','confirmed','completed','cancelled') NOT NULL DEFAULT 'pending',
	`depositStatus` enum('unpaid','checkout_started','paid','failed','refunded') NOT NULL DEFAULT 'unpaid',
	`stripePaymentIntentId` varchar(255),
	`stripeCheckoutSessionId` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bookings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `galleryImages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(180) NOT NULL,
	`category` enum('Braids','Twists','Locs','Kids Styles','Behind the Chair') NOT NULL,
	`imageUrl` varchar(800) NOT NULL,
	`altText` varchar(255) NOT NULL,
	`isPublished` enum('true','false') NOT NULL DEFAULT 'true',
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `galleryImages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `newsletterSubscribers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`productAlerts` enum('true','false') NOT NULL DEFAULT 'false',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `newsletterSubscribers_id` PRIMARY KEY(`id`),
	CONSTRAINT `newsletterSubscribers_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `orderItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`productId` int NOT NULL,
	`variantId` int,
	`productName` varchar(180) NOT NULL,
	`variantName` varchar(120),
	`quantity` int NOT NULL DEFAULT 1,
	`unitPrice` decimal(10,2) NOT NULL,
	CONSTRAINT `orderItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerName` varchar(180) NOT NULL,
	`customerEmail` varchar(320) NOT NULL,
	`customerPhone` varchar(80),
	`addressLine1` varchar(255) NOT NULL,
	`city` varchar(120) NOT NULL,
	`county` varchar(120),
	`postcode` varchar(40) NOT NULL,
	`deliveryNote` text,
	`status` enum('draft','pending_payment','paid','fulfilling','shipped','completed','cancelled') NOT NULL DEFAULT 'draft',
	`stripeCheckoutSessionId` varchar(255),
	`stripePaymentIntentId` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `productVariants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`colourHex` varchar(20),
	`stockQuantity` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `productVariants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(180) NOT NULL,
	`slug` varchar(220) NOT NULL,
	`category` enum('Accessories','Aftercare','Hair Attachments') NOT NULL,
	`description` text NOT NULL,
	`price` decimal(10,2) NOT NULL,
	`imageUrl` varchar(800),
	`badge` varchar(80),
	`stockStatus` enum('in_stock','low_stock','out_of_stock') NOT NULL DEFAULT 'in_stock',
	`stockQuantity` int NOT NULL DEFAULT 0,
	`isFeatured` enum('true','false') NOT NULL DEFAULT 'false',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `products_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerName` varchar(180) NOT NULL,
	`rating` int NOT NULL,
	`reviewText` text NOT NULL,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`source` varchar(80) NOT NULL DEFAULT 'website',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(180) NOT NULL,
	`slug` varchar(220) NOT NULL,
	`category` enum('Braids','Twists','Locs','Kids Styles','Add-ons') NOT NULL,
	`description` text NOT NULL,
	`duration` varchar(80) NOT NULL,
	`priceFrom` decimal(10,2) NOT NULL,
	`badge` varchar(80),
	`imageUrl` varchar(800),
	`isBookable` enum('true','false') NOT NULL DEFAULT 'true',
	`isFeatured` enum('true','false') NOT NULL DEFAULT 'false',
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `services_id` PRIMARY KEY(`id`),
	CONSTRAINT `services_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `tryOnGenerations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`styleName` varchar(160) NOT NULL,
	`originalImageUrl` varchar(800) NOT NULL,
	`generatedImageUrl` varchar(800),
	`status` enum('pending','completed','failed') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tryOnGenerations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `websiteSections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sectionKey` varchar(80) NOT NULL,
	`title` varchar(255) NOT NULL,
	`eyebrow` varchar(160),
	`body` text,
	`ctaLabel` varchar(120),
	`ctaHref` varchar(500),
	`imageUrl` varchar(800),
	`sortOrder` int NOT NULL DEFAULT 0,
	`isPublished` enum('true','false') NOT NULL DEFAULT 'true',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `websiteSections_id` PRIMARY KEY(`id`),
	CONSTRAINT `websiteSections_sectionKey_unique` UNIQUE(`sectionKey`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `stripeCustomerId` varchar(255);