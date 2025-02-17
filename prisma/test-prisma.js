const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  const group = await prisma.group.findFirst();
  console.log(group.cyclesCompleted); // Check if this field exists
}

test()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());