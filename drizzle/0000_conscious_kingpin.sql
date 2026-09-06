CREATE TABLE `characters` (
	`owner` text NOT NULL,
	`slot` integer NOT NULL,
	`revision` integer NOT NULL,
	`object` text,
	`previous` text,
	`summary` text,
	`operation` text NOT NULL,
	`digest` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`owner`, `slot`)
);
