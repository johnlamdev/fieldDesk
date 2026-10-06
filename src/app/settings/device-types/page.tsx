import { ActionForm } from "@/app/action-form";
import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { addDeviceType, updateDeviceType } from "@/app/actions/crm";

export default async function DeviceTypes() {
  await requireUser(["admin", "engineer"]);
  const types = await prisma.deviceType.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return <><h1>設備類型</h1><p>管理員及工程師可新增、更名或停用設備類型。更名或停用不會改動已有設備的記錄。</p><section><h2>新增類型</h2><ActionForm name="addDeviceType"><label>名稱<input name="name" required maxLength={100} /></label><button>新增</button></ActionForm></section><section><h2>現有類型</h2>{types.map(type => <ActionForm key={type.id} formKey={type.id} name="updateDeviceType" className="device-type-row"><input type="hidden" name="id" value={type.id} /><label>名稱<input name="name" required maxLength={100} defaultValue={type.name} /></label><label className="inline-control"><input type="checkbox" name="active" defaultChecked={type.active} />可選用</label><button>儲存</button></ActionForm>)}</section></>;
}
