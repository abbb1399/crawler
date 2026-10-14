import { PrismaPg } from '@prisma/adapter-pg';
import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '../src/generated/prisma/client';

loadEnv({ path: ['.env', '../../.env'] });

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
});

async function main() {
  const profile = await prisma.searchProfile.upsert({
    where: { name: 'default' },
    create: {
      name: 'default',
      keywords: ['nestjs', 'node.js 백엔드'],
      sources: ['WANTED', 'JOBKOREA'],
    },
    update: {},
  });
  console.log(`seeded SearchProfile #${profile.id} "${profile.name}" keywords=${profile.keywords.join(', ')}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
