import { sqliteTable, text, integer, primaryKey, index } from 'drizzle-orm/sqlite-core';
export const characters = sqliteTable('characters', {
  owner: text('owner').notNull(), slot: integer('slot').notNull(), revision: integer('revision').notNull(),
  object: text('object'), previous: text('previous'), summary: text('summary'),
  chronicle: text('chronicle'),
  rankName: text('rank_name'), rankLevel: integer('rank_level'), rankGear: integer('rank_gear'),
  rankGearCheckedAt: integer('rank_gear_checked_at'),
  operation: text('operation').notNull(), digest: text('digest').notNull(), updatedAt: integer('updated_at').notNull(),
}, table => [primaryKey({ columns: [table.owner, table.slot] }), index('characters_rank_level').on(table.rankLevel, table.rankGear), index('characters_rank_gear').on(table.rankGear, table.rankLevel)]);
