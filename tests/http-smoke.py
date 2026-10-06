"""End-to-end synthetic CRM smoke test. Requires the isolated 3001/5444 servers."""
import http.cookiejar
import json
import os
import re
import time
import urllib.error
import urllib.request
from datetime import datetime
from html.parser import HTMLParser
from zoneinfo import ZoneInfo

BASE = "http://127.0.0.1:3001"
PASSWORD = os.environ["SMOKE_PASSWORD"]
assert len(PASSWORD) >= 12

class Forms(HTMLParser):
    def __init__(self):
        super().__init__()
        self.forms = []
        self.current = None
    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag == "form":
            self.current = {}
            self.forms.append(self.current)
        if self.current is not None and tag in ("input", "select", "textarea") and attributes.get("name"):
            self.current[attributes["name"]] = attributes.get("value", "")
    def handle_endtag(self, tag):
        if tag == "form":
            self.current = None

class Session:
    def __init__(self, email):
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        payload = json.dumps({"email": email, "password": PASSWORD}).encode()
        response = self.opener.open(urllib.request.Request(BASE + "/api/auth/sign-in/email", data=payload, headers={"Content-Type": "application/json"}), timeout=60)
        assert response.status == 200, (email, response.status)
        response.read()
    def get(self, path):
        try:
            response = self.opener.open(BASE + path, timeout=60)
            return response.status, response.url, response.read().decode()
        except urllib.error.HTTPError as error:
            return error.code, error.url, error.read().decode()
    def submit(self, path, required, values):
        status, _, html = self.get(path)
        assert status == 200, (path, status)
        parser = Forms()
        parser.feed(html)
        choices = [form for form in parser.forms if all(name in form for name in required)]
        assert len(choices) == 1, (path, required, [list(form) for form in parser.forms])
        form = choices[0]
        form.update(values)
        return self.post(path, form)
    def post(self, path, form):
        boundary = "----FieldDeskSyntheticSmoke20261005"
        parts = []
        for key, value in form.items():
            parts.append((f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n').encode())
        parts.append((f'--{boundary}--\r\n').encode())
        request = urllib.request.Request(BASE + path, data=b"".join(parts), headers={"Content-Type": f"multipart/form-data; boundary={boundary}", "Origin": BASE, "Referer": BASE + path})
        try:
            response = self.opener.open(request, timeout=20)
            return response.status, response.url, response.read().decode()
        except urllib.error.HTTPError as error:
            return error.code, error.url, error.read().decode()

admin = Session("admin.smoke@example.com")
engineer = Session("engineer.smoke@example.com")
technician = Session("technician.smoke@example.com")
assert admin.get("/admin/users")[0] == 200
assert engineer.get("/admin/users")[0] == 404
assert technician.get("/cases")[0] == 404
print("角色頁面：管理員 200、工程師人員頁 404、師傅個案頁 404")

admin_case_html = admin.get("/cases")[2]
admin_forms = Forms()
admin_forms.feed(admin_case_html)
forbidden_form = next(form for form in admin_forms.forms if "customerName" in form and "caseId" not in form)
forbidden_form.update({"customerName": "不應建立的個案", "referenceCode": "FORBIDDEN-" + str(int(time.time()))})
assert technician.post("/cases", forbidden_form)[0] == 404
print("師傅直接提交個案建立 Action：拒絕")

staff_forms = Forms()
staff_forms.feed(admin.get("/admin/users")[2])
create_staff_form = next(form for form in staff_forms.forms if "password" in form and "email" in form)
create_staff_form.update({"email": "forbidden.smoke@example.com", "name": "不應建立", "password": PASSWORD, "role": "engineer"})
assert engineer.post("/admin/users", create_staff_form)[0] == 404
assert technician.post("/admin/users", create_staff_form)[0] == 404
print("非管理員直接提交新增人員 Action：拒絕")

suffix = str(int(time.time()))
status, case_url, _ = admin.submit("/cases", ["customerName", "referenceCode"], {"customerName": "虛構驗收客戶", "addressRaw": "測試路 1 號", "referenceCode": "SMOKE-" + suffix, "contactName": "虛構聯絡人", "contactPhone": "00000000", "remark": "合成資料"})
assert status == 200 and re.fullmatch(BASE + r"/cases/[0-9a-f-]+", case_url), (status, case_url)
case_path = case_url.removeprefix(BASE)
print("個案建立：成功")
case_forms = Forms()
case_forms.feed(admin.get(case_path)[2])
for required in (["caseId", "tentativeAt", "type"], ["caseId", "identifierRaw", "serialRaw"], ["caseId", "deviceId", "type", "remark"]):
    forbidden = next(form for form in case_forms.forms if all(key in form for key in required))
    assert technician.post(case_path, forbidden)[0] == 404, required
print("師傅直接提交任務、設備、事件 Action：全部拒絕")
assert engineer.get(case_path)[0] == 200
status, _, _ = engineer.submit(case_path, ["caseId", "customerName", "referenceCode"], {"customerName": "虛構驗收客戶（工程師修正）", "addressRaw": "測試路 1 號", "referenceCode": "SMOKE-" + suffix, "contactName": "虛構聯絡人", "contactPhone": "00000000", "remark": "合成資料"})
assert status == 200
print("工程師修改個案：成功")

status, error_url, _ = admin.submit(case_path, ["caseId", "deviceId", "type", "remark"], {"type": "其他", "deviceId": "", "remark": ""})
assert status == 200 and error_url.startswith(BASE + case_path + "?formAction=createEvent") and "formError=" in error_url
print("表單錯誤：回到原頁並附上清楚提示")

status, device_url, _ = admin.submit(case_path, ["caseId", "identifierRaw", "serialRaw"], {"type": "設備1", "identifierRaw": "SMOKE-DEVICE-1", "serialRaw": "SMOKE-SN-1", "location": "門口", "remark": "合成資料"})
assert status == 200 and "/devices/" in device_url, (status, device_url)
print("設備建立：成功")
device_path = device_url.removeprefix(BASE)
status, _, _ = admin.submit(device_path, ["deviceId", "reason"], {"reason": "合成測試刪除"})
assert status == 200 and "已刪除設備" in admin.get(case_path)[2]
status, _, _ = admin.submit(device_path, ["deviceId"], {})
assert status == 200 and "已刪除設備" not in admin.get(case_path)[2]
print("設備刪除及復原：成功")

status, event_url, _ = admin.submit(case_path, ["caseId", "deviceId", "type", "remark"], {"type": "設備故障", "deviceId": "", "remark": "合成故障事件"})
assert status == 200 and "/events/" in event_url, (status, event_url)
print("事件建立：成功")

status, visit_url, _ = admin.submit(case_path, ["caseId", "tentativeAt", "type"], {"type": "安裝", "tentativeAt": "2026-10-07T09:00"})
assert status == 200 and "/visits/" in visit_url, (status, visit_url)
visit_path = visit_url.removeprefix(BASE)
print("帶時間的上門任務建立：成功")
assert engineer.get(visit_path)[0] == 200
assert admin.get("/")[0] == 200 and technician.get("/")[0] == 200

status, _, visit_html = admin.get(visit_path)
assert status == 200
engineer_id = re.search(r'<option value="([^"]+)">測試工程師.*?工程師</option>', visit_html).group(1)
technician_id = re.search(r'<option value="([^"]+)">測試師傅.*?師傅</option>', visit_html).group(1)
for user_id in (engineer_id, technician_id):
    status, _, _ = admin.submit(visit_path, ["visitId", "userId", "isLead"], {"userId": user_id, "isLead": "on"})
    assert status == 200
assert technician.get(visit_path)[0] == 200
print("工程師及師傅指派：成功；師傅獲指派任務可見")

status, _, _ = admin.submit(visit_path, ["visitId", "bookedAt", "status"], {"tentativeAt": "2026-10-07T09:00", "bookedAt": "2026-10-07T10:00", "status": "已預約", "siteVisitConclusion": "", "incompleteReason": "", "cancellationReason": "", "reasonDetail": "", "remark": "虛構預約"})
assert status == 200
print("正式預約：成功")

status, _, _ = admin.submit(visit_path, ["visitId", "bookedAt", "status"], {"tentativeAt": "2026-10-07T09:00", "bookedAt": "2026-10-07T10:00", "status": "已完成", "siteVisitConclusion": "", "incompleteReason": "", "cancellationReason": "", "reasonDetail": "", "remark": "合成安裝完成"})
assert status == 200
assert "已完成安裝" in admin.get(case_path)[2]
print("安裝完成及個案狀態連動：成功")

status, _, _ = admin.submit(visit_path, ["visitId", "reason"], {"reason": "合成測試：誤標完成"})
assert status == 200
assert "已安排安裝" in admin.get(case_path)[2]
print("誤標完成更正及個案狀態回復：成功")

status, second_visit_url, _ = admin.submit(case_path, ["caseId", "tentativeAt", "type"], {"type": "現場勘察", "tentativeAt": "2026-10-08T09:00"})
assert status == 200 and "/visits/" in second_visit_url
second_visit_path = second_visit_url.removeprefix(BASE)
assert technician.get(second_visit_path)[0] == 404
print("師傅未獲指派任務：404")

status, _, _ = admin.submit(second_visit_path, ["visitId", "userId", "isLead"], {"userId": engineer_id, "isLead": "on"})
assert status == 200
status, _, _ = admin.submit(second_visit_path, ["visitId", "bookedAt", "status"], {"tentativeAt": "2026-10-08T09:00", "bookedAt": "2026-10-07T10:00", "status": "已預約", "siteVisitConclusion": "", "incompleteReason": "", "cancellationReason": "", "reasonDetail": "", "remark": "合成衝突測試"})
assert status == 200 and "時間衝突" in admin.get(second_visit_path)[2]
print("同一工程師同時預約：顯示衝突警告")

# A cancelled booking must retain its reason; a new booking can then use a new time.
status, error_url, _ = admin.submit(second_visit_path, ["visitId", "bookedAt", "status"], {"tentativeAt": "2026-10-08T09:00", "bookedAt": "2026-10-07T10:00", "status": "已取消", "cancellationReason": "其他", "reasonDetail": ""})
assert status == 200 and "formError=" in error_url
status, _, _ = admin.submit(second_visit_path, ["visitId", "bookedAt", "status"], {"tentativeAt": "2026-10-08T09:00", "bookedAt": "2026-10-07T10:00", "status": "已取消", "cancellationReason": "其他", "reasonDetail": "虛構客戶要求改期"})
assert status == 200 and "已取消" in admin.get(second_visit_path)[2]
assert re.search(r"取消原因：(?:<!--.*?-->)*其他", admin.get(second_visit_path)[2])
assert "已安排現場勘察" in admin.get(case_path)[2]  # V1: cancellation does not change case status.
cancelled_forms = Forms()
cancelled_forms.feed(admin.get(second_visit_path)[2])
cancelled_update = next(form for form in cancelled_forms.forms if "bookedAt" in form and "status" in form)
assert cancelled_update["reasonDetail"] == "虛構客戶要求改期"
assert cancelled_update["remark"] == ""
status, rescheduled_url, _ = admin.submit(second_visit_path, ["visitId", "bookedAt", "status"], {"tentativeAt": "2026-10-09T09:00", "bookedAt": "2026-10-09T10:00", "status": "已預約", "cancellationReason": "", "reasonDetail": ""})
assert status == 200 and "formError=" not in rescheduled_url and "2026-10-09T10:00" in admin.get(second_visit_path)[2]
assert "原因：虛構客戶要求改期" not in admin.get(second_visit_path)[2]
print("取消原因驗證、取消及重新預約改期：成功")

status, error_url, _ = admin.submit(visit_path, ["visitId", "bookedAt", "status"], {"tentativeAt": "2026-10-07T09:00", "bookedAt": "2026-10-07T10:00", "status": "未完成", "incompleteReason": ""})
assert status == 200 and "formError=" in error_url
status, _, _ = admin.submit(visit_path, ["visitId", "bookedAt", "status"], {"tentativeAt": "2026-10-07T09:00", "bookedAt": "2026-10-07T10:00", "status": "未完成", "incompleteReason": "設備／物料問題"})
assert status == 200 and re.search(r"未完成原因：(?:<!--.*?-->)*設備／物料問題", admin.get(visit_path)[2])
assert "已安排現場勘察" in admin.get(case_path)[2]  # V1: incomplete visit does not change case status.
print("未完成原因驗證與個案狀態保持原值：成功")

status, error_url, _ = admin.submit(second_visit_path, ["visitId", "bookedAt", "status"], {"tentativeAt": "2026-10-09T09:00", "bookedAt": "2026-10-09T10:00", "status": "已完成", "siteVisitConclusion": ""})
assert status == 200 and "formError=" in error_url
status, _, _ = admin.submit(second_visit_path, ["visitId", "bookedAt", "status"], {"tentativeAt": "2026-10-09T09:00", "bookedAt": "2026-10-09T10:00", "status": "已完成", "siteVisitConclusion": "可以安裝"})
assert status == 200 and "待安排安裝" in admin.get(case_path)[2]
status, _, _ = admin.submit(second_visit_path, ["visitId", "reason"], {"reason": "虛構勘察結論更正"})
assert status == 200 and "已安排現場勘察" in admin.get(case_path)[2]
print("勘察結論驗證、完成及誤標更正：成功")

status, incident_url, _ = admin.submit(case_path, ["caseId", "tentativeAt", "type"], {"type": "事件處理", "tentativeAt": "2026-10-10T14:00"})
assert status == 200 and "/visits/" in incident_url
incident_path = incident_url.removeprefix(BASE)
status, error_url, _ = admin.submit(incident_path, ["visitId", "bookedAt", "status"], {"tentativeAt": "2026-10-10T14:00", "bookedAt": "", "status": "已完成"})
assert status == 200 and "formError=" in error_url
event_path = event_url.removeprefix(BASE)
status, _, _ = admin.submit(event_path, ["eventId", "visitId"], {"visitId": incident_path.rsplit("/", 1)[1]})
assert status == 200
status, _, _ = admin.submit(incident_path, ["visitId", "bookedAt", "status"], {"tentativeAt": "2026-10-10T14:00", "bookedAt": "", "status": "已完成"})
assert status == 200 and "已完成" in admin.get(incident_path)[2]
event_forms = Forms()
event_forms.feed(admin.get(event_path)[2])
unlink_form = next(form for form in event_forms.forms if form.get("visitId") == incident_path.rsplit("/", 1)[1])
status, error_url, _ = admin.post(event_path, unlink_form)
assert status == 200 and "formError=" in error_url
print("事件處理須連結事件；完成後禁止移除最後連結：成功")

today = datetime.now(ZoneInfo("Asia/Hong_Kong")).strftime("%Y-%m-%d")
status, today_visit_url, _ = admin.submit(case_path, ["caseId", "tentativeAt", "type"], {"type": "安裝", "tentativeAt": today + "T13:00"})
assert status == 200 and "/visits/" in today_visit_url
today_visit_path = today_visit_url.removeprefix(BASE)
for user_id in (engineer_id, technician_id):
    assert admin.submit(today_visit_path, ["visitId", "userId", "isLead"], {"userId": user_id, "isLead": "on"})[0] == 200
assert admin.submit(today_visit_path, ["visitId", "bookedAt", "status"], {"tentativeAt": today + "T13:00", "bookedAt": today + "T14:00", "status": "已預約"})[0] == 200
assert admin.submit(today_visit_path, ["visitId", "bookedAt", "status"], {"tentativeAt": today + "T13:00", "bookedAt": today + "T14:00", "status": "已取消", "cancellationReason": "客戶取消"})[0] == 200
for session in (admin, technician):
    home_html = session.get("/")[2]
    assert "虛構驗收客戶" in home_html and "測試路 1 號" in home_html
    assert "客戶取消" in home_html and "測試工程師" in home_html and "測試師傅" in home_html
print("管理員及師傅今日首頁：地址、同行人員及取消原因顯示正確")

status, archived_case_url, _ = admin.submit("/cases", ["customerName", "referenceCode"], {"customerName": "虛構封存個案", "addressRaw": "", "referenceCode": "ARCHIVE-" + suffix, "contactName": "", "contactPhone": "", "remark": ""})
assert status == 200 and "/cases/" in archived_case_url
archived_case_path = archived_case_url.removeprefix(BASE)
status, _, _ = admin.submit(archived_case_path, ["caseId", "reason"], {"reason": "合成測試封存"})
assert status == 200 and "個案已封存" in admin.get(archived_case_path)[2]
status, _, _ = admin.submit(archived_case_path, ["caseId"], {})
assert status == 200 and "個案已封存" not in admin.get(archived_case_path)[2]
print("空白個案封存與復原：成功")

staff_email = "new.engineer." + suffix + "@example.com"
status, staff_url, _ = admin.submit("/admin/users", ["email", "password", "name"], {"email": staff_email, "password": PASSWORD, "name": "新增虛構工程師", "role": "engineer"})
assert status == 200 and staff_url == BASE + "/admin/users"
assert staff_email in admin.get("/admin/users")[2]
print("管理員新增工程師帳號：成功")

public = urllib.request.Request(BASE + "/api/auth/sign-up/email", data=json.dumps({"email": "public.smoke@example.com", "name": "公開註冊", "password": PASSWORD}).encode(), headers={"Content-Type": "application/json"})
try:
    urllib.request.urlopen(public, timeout=60)
    raise AssertionError("公開註冊意外成功")
except urllib.error.HTTPError as error:
    assert error.code == 400, error.code
print("公開註冊：拒絕")
