import { createAuth } from "../src/lib/auth";
import { prisma } from "../src/lib/prisma";

async function main() {
  const [email, name, role] = process.argv.slice(2);
  if (!email || !name || !["admin", "engineer", "technician"].includes(role)) throw new Error("用法：npm run user:add -- email name admin|engineer|technician");
  const existingAdmin = await prisma.user.count({ where: { role: "admin" } });
  if (role === "admin" && existingAdmin) throw new Error("管理員已存在；後續人員須由管理員建立");
  if (role !== "admin" && !existingAdmin) throw new Error("請先建立管理員");
  const password = process.env.NEW_USER_PASSWORD;
  if (!password || password.length < 12) throw new Error("請用 NEW_USER_PASSWORD 環境變數提供至少 12 字元的密碼");
  const signupAuth = createAuth(true);
  const response = await signupAuth.api.signUpEmail({ body: { email, name, password } });
  await prisma.user.update({ where: { id: response.user.id }, data: { role } });
  console.log(`Created ${role}: ${email}`);
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
