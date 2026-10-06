// Run only against the isolated smoke database on 127.0.0.1:5444.
import { createAuth } from "../src/lib/auth";
import { prisma } from "../src/lib/prisma";

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (url.hostname !== "127.0.0.1" || url.port !== "5444" || url.pathname !== "/fielddesk_test") throw new Error("只可對隔離測試庫執行");
  const password = process.env.SMOKE_PASSWORD;
  if (!password || password.length < 12) throw new Error("缺少測試密碼");
  const auth = createAuth(true);
  for (const [email, name, role] of [
    ["admin.smoke@example.com", "測試管理員", "admin"],
    ["engineer.smoke@example.com", "測試工程師", "engineer"],
    ["technician.smoke@example.com", "測試師傅", "technician"],
  ]) {
    const response = await auth.api.signUpEmail({ body: { email, name, password } });
    await prisma.user.update({ where: { id: response.user.id }, data: { role } });
  }
  console.log("已建立三個虛構測試角色");
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
