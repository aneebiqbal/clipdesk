import { Prisma } from "@prisma/client";
import { prisma } from "./lib/prisma";

async function main(): Promise<void> {
  await prisma.settings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      clips: 3,
      voice: true,
      music: true,
      config: { gameName: "GTA 6" } as Prisma.InputJsonValue,
    },
  });

  await prisma.topic.upsert({
    where: { id: "builtin-voice" },
    create: {
      id: "builtin-voice",
      name: "Voice Highlights",
      isBuiltIn: true,
      sortOrder: 998,
    },
    update: {},
  });

  await prisma.topic.upsert({
    where: { id: "builtin-timestamps" },
    create: {
      id: "builtin-timestamps",
      name: "Custom Timestamps",
      isBuiltIn: true,
      sortOrder: 999,
    },
    update: {},
  });

  console.log("Seeded default settings and built-in topics.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
