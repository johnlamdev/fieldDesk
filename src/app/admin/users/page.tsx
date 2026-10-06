import { ActionForm } from "@/app/action-form";
import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { createStaff, updateStaff } from "@/app/actions/users";

export default async function Users() {
  await requireUser(["admin"]);
  const users = await prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, active: true }, orderBy: { name: "asc" } });
  return <>
    <h1>人員</h1>
    <section><h2>新增人員</h2><ActionForm name="createStaff"><label>姓名<input name="name" required maxLength={150} /></label><label>電郵<input name="email" type="email" required maxLength={320} /></label><label>角色<select name="role"><option value="engineer">工程師</option><option value="technician">師傅</option><option value="admin">管理員</option></select></label><label>初始密碼<input name="password" type="password" required minLength={12} autoComplete="new-password" /></label><button>新增人員</button></ActionForm></section>
    <section><h2>現有人員</h2>{users.map(u => <ActionForm key={u.id} formKey={u.id} name="updateStaff" className="staff-row"><input type="hidden" name="id" value={u.id} /><p>{u.email}</p><label>姓名<input name="name" required defaultValue={u.name} maxLength={150} /></label><label>角色<select name="role" defaultValue={u.role}><option value="admin">管理員</option><option value="engineer">工程師</option><option value="technician">師傅</option></select></label><label className="inline-control"><input type="checkbox" name="active" defaultChecked={u.active} />啟用</label><button>儲存</button></ActionForm>)}</section>
  </>;
}
