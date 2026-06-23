import Database from 'better-sqlite3';
import * as schema from './schema';
declare const databasePath: string;
export declare const db: import("drizzle-orm/better-sqlite3").BetterSQLite3Database<typeof schema> & {
    $client: Database.Database;
};
export { schema, databasePath };
export declare function initializeDatabase(): void;
//# sourceMappingURL=index.d.ts.map