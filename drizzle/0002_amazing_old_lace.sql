ALTER TABLE `characters` ADD `rank_name` text;--> statement-breakpoint
ALTER TABLE `characters` ADD `rank_level` integer;--> statement-breakpoint
ALTER TABLE `characters` ADD `rank_gear` integer;--> statement-breakpoint
CREATE INDEX `characters_rank_level` ON `characters` (`rank_level`,`rank_gear`);--> statement-breakpoint
CREATE INDEX `characters_rank_gear` ON `characters` (`rank_gear`,`rank_level`);--> statement-breakpoint
UPDATE characters SET rank_name=json_extract(summary,'$.name'), rank_level=json_extract(summary,'$.level'), rank_gear=json_extract(summary,'$.gearPower') WHERE object IS NOT NULL AND summary IS NOT NULL AND json_valid(summary);
