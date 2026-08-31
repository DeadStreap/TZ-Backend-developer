import { buildApp } from './app.js';
import { getPrisma } from './config/prisma.js';
import { env } from './config/env.js';

const prisma = getPrisma();

async function main() {
  const app = await buildApp();

  const shutdown = async () => {
    console.log('Shutting down...');
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    console.log(`Server running on http://localhost:${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
