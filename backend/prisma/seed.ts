import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Hash passwords
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const attendantPasswordHash = await bcrypt.hash('atendente123', 10);

  // Create admin user
  const admin = await prisma.attendant.upsert({
    where: { email: 'admin@empresa.com' },
    update: {},
    create: {
      name: 'Administrador',
      email: 'admin@empresa.com',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      status: 'ONLINE',
      mode: 'SUGGEST',
      maxChats: 10,
    },
  });
  console.log('✅ Admin user created:', admin.email);

  // Create attendant user
  const attendant = await prisma.attendant.upsert({
    where: { email: 'atendente@empresa.com' },
    update: {},
    create: {
      name: 'Atendente Padrão',
      email: 'atendente@empresa.com',
      passwordHash: attendantPasswordHash,
      role: 'ATTENDANT',
      status: 'ONLINE',
      mode: 'SUGGEST',
      maxChats: 5,
    },
  });
  console.log('✅ Attendant user created:', attendant.email);

  // Create default business hours (Monday to Friday, 8am to 6pm)
  const businessHours = [
    { dayOfWeek: 1, openTime: '08:00', closeTime: '18:00' },
    { dayOfWeek: 2, openTime: '08:00', closeTime: '18:00' },
    { dayOfWeek: 3, openTime: '08:00', closeTime: '18:00' },
    { dayOfWeek: 4, openTime: '08:00', closeTime: '18:00' },
    { dayOfWeek: 5, openTime: '08:00', closeTime: '18:00' },
  ];

  for (const bh of businessHours) {
    await prisma.businessHours.upsert({
      where: { id: `bh-${bh.dayOfWeek}` },
      update: bh,
      create: { ...bh, id: `bh-${bh.dayOfWeek}` },
    });
  }
  console.log('✅ Business hours created');

  // Create default auto messages
  const autoMessages = [
    { type: 'OUT_OF_HOURS', content: 'Olá! Estamos fora do horário de atendimento. Responderemos assim que possível.' },
    { type: 'BLOCKED', content: 'Você foi bloqueado pelo nosso sistema. Entre em contato para mais informações.' },
    { type: 'WELCOME', content: 'Olá! Bem-vindo ao nosso atendimento. Em breve um atendente irá te responder.' },
  ];

  for (const am of autoMessages) {
    await prisma.autoMessage.upsert({
      where: { type: am.type },
      update: am,
      create: am,
    });
  }
  console.log('✅ Auto messages created');

  // Create default tags
  const tags = [
    { name: 'Cliente VIP', color: '#f59e0b' },
    { name: 'Suporte Técnico', color: '#3b82f6' },
    { name: 'Vendas', color: '#10b981' },
    { name: 'Reclamação', color: '#ef4444' },
  ];

  for (const tag of tags) {
    await prisma.tag.upsert({
      where: { name: tag.name },
      update: tag,
      create: tag,
    });
  }
  console.log('✅ Default tags created');

  console.log('🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
