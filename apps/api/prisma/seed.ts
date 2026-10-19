import { PrismaPg } from '@prisma/adapter-pg';
import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '../src/generated/prisma/client';

loadEnv({ path: ['.env', '../../.env'] });

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
});

// Default profile: full-stack / product-engineer roles that a frontend-heavy engineer can apply to.
// Wanted's search is tag-aware ("풀스택" alone returns mostly relevant postings); Saramin's is fuzzy,
// so the title filters below do most of the work there.
const DEFAULT_PROFILE = {
  name: '풀스택·프로덕트',
  keywords: ['풀스택', '풀스택 개발자', 'fullstack', '프로덕트 엔지니어', 'product engineer', 'node.js 풀스택', 'typescript 풀스택', 'next.js'],
  includeTitle: [
    '풀스택', '풀 스택', '풀스텍', 'full stack', 'fullstack', 'full-stack',
    '프로덕트 엔지니어', 'product engineer', '프로덕트 개발자', 'product developer',
    '웹 개발자', '웹개발자', 'web developer', '소프트웨어 엔지니어', 'software engineer',
  ],
  // Non-dev roles that share the same words, plus stacks that are not a fit. Substring match,
  // so "java" is deliberately absent (it would also drop "javascript").
  excludeTitle: [
    '마케터', '마케팅', '디자이너', 'designer', '매니저', 'manager', '프로덕트 오너', 'product owner', '영업', 'qa', '품질',
    '컴파일러', '반도체', 'cxl', 'plc', '기구', 'salesforce', '강사', '과정', '사업화',
    'spring', 'jsp', 'php', '.net', 'c#', 'egov', '전자정부', 'flutter', 'unity',
  ],
  sources: ['WANTED', 'SARAMIN'] as const,
};

async function main() {
  const { name, sources, ...filters } = DEFAULT_PROFILE;
  const profile = await prisma.searchProfile.upsert({
    where: { name },
    create: { name, sources: [...sources], ...filters },
    // Re-running the seed re-applies the defaults to this profile only.
    update: { ...filters },
  });
  console.log(
    `seeded SearchProfile #${profile.id} "${profile.name}" keywords=${profile.keywords.join(', ')} include=${profile.includeTitle.join(', ')}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
