export async function uploadToCatbox(buffer: Buffer, originalname: string, mimetype: string): Promise<string> {
  const formData = new FormData();
  formData.append("reqtype", "fileupload");
  const blob = new Blob([new Uint8Array(buffer)], { type: mimetype });
  formData.append("fileToUpload", blob, originalname);

  const response = await fetch("https://catbox.moe/user/api.php", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Catbox upload HTTP ${response.status} failed: ${errText}`);
  }

  const fileUrl = await response.text();
  if (!fileUrl.trim().startsWith("https://files.catbox.moe/")) {
    throw new Error(`Catbox upload failed: ${fileUrl}`);
  }

  return fileUrl.trim();
}
