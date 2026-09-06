import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
export const characters = sqliteTable('characters', {
  owner: text('owner').notNull(), slot: integer('slot').notNull(), revision: integer('revision').notNull(),
  object: text('object'), previous: text('previous'), summary: text('summary'),
  operation: text('operation').notNull(), digest: text('digest').notNull(), updatedAt: integer('updated_at').notNull(),
}, table => [primaryKey({ columns: [table.owner, table.slot] })]);
