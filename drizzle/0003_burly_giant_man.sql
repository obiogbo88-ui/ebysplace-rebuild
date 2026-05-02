ALTER TABLE `websiteSections` ADD `portraitImageUrl` varchar(800);--> statement-breakpoint
ALTER TABLE `websiteSections` ADD `portraitDescription` text;
--> statement-breakpoint
UPDATE `websiteSections`
SET `eyebrow` = 'Our Story',
    `title` = 'From Passion to Power',
    `body` = 'Eby’s Place was born from a love for braiding and a belief that beautiful hair should never come with pain, pulling, or damage. What began as a passion for helping women and families feel confident has grown into a premium braid-care experience built on gentle hands, neat finishing, protective styling, and genuine customer care.',
    `portraitDescription` = COALESCE(`portraitDescription`, 'A personal Eby’s Place portrait can be added here from the admin dashboard, with a short description that reflects the heart behind the brand.')
WHERE `sectionKey` = 'about_us';
