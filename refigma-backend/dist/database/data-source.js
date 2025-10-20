"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
const path_1 = __importDefault(require("path"));
const typeorm_1 = require("typeorm");
const envCandidates = [
    process.env.ENV_FILE,
    process.env.NODE_ENV === 'test' ? '.env.test' : undefined,
    path_1.default.resolve(process.cwd(), '.env'),
    path_1.default.resolve(process.cwd(), '..', '.env'),
];
for (const candidate of envCandidates) {
    if (!candidate)
        continue;
    (0, dotenv_1.config)({ path: candidate, override: true });
}
const isTsEnv = process.env.TS_NODE === 'true';
const fileExt = isTsEnv ? 'ts' : 'js';
const rootDir = isTsEnv ? 'src' : 'dist';
const baseOptions = {
    type: 'postgres',
    url: process.env.DATABASE_URL || undefined,
    host: process.env.DATABASE_HOST,
    port: process.env.DATABASE_PORT ? Number(process.env.DATABASE_PORT) : 5432,
    username: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    synchronize: false,
    logging: process.env.TYPEORM_LOGGING === 'true',
    entities: [`${rootDir}/**/*.entity.${fileExt}`],
    migrations: [`${rootDir}/database/migrations/*.${fileExt}`],
    migrationsTableName: 'migrations',
    ssl: process.env.DATABASE_SSL === 'true',
};
const dataSource = new typeorm_1.DataSource(baseOptions);
exports.default = dataSource;
//# sourceMappingURL=data-source.js.map