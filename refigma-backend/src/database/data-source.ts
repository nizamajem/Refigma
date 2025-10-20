import { config } from 'dotenv';
import path from 'path';
import { DataSource, DataSourceOptions } from 'typeorm';

const envCandidates = [
  process.env.ENV_FILE,
  process.env.NODE_ENV === 'test' ? '.env.test' : undefined,
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '..', '.env'),
];

for (const candidate of envCandidates) {
  if (!candidate) continue;
  config({ path: candidate, override: true });
}

const isTsEnv = process.env.TS_NODE === 'true';
const fileExt = isTsEnv ? 'ts' : 'js';
const rootDir = isTsEnv ? 'src' : 'dist';

const baseOptions: DataSourceOptions = {
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

const dataSource = new DataSource(baseOptions);

export default dataSource;
