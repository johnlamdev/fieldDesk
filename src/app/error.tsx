"use client";
export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <section><h1>未能完成操作</h1><p role="alert">請檢查網絡。若剛才正在儲存，請先查看記錄，確認是否已儲存，避免重複建立。</p><button onClick={() => retry()}>重新載入</button></section>;
}
