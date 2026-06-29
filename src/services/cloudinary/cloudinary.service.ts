/**
 * Servicio de subida de imágenes a Cloudinary (unsigned upload)
 *
 * Requiere en .env:
 *   VITE_CLOUDINARY_CLOUD_NAME=tu-cloud-name
 *   VITE_CLOUDINARY_UPLOAD_PRESET=tu-upload-preset
 */

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "";
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "";

function dataUrlToFile(dataUrl: string, filename = "image.png"): File {
  const arr = dataUrl.split(",");
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : "image/png";
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

export async function uploadImageToCloudinary(
  dataUrl: string,
  folder = "footcare"
): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith("data:")) {
    return dataUrl;
  }

  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error(
      "Faltan variables de entorno de Cloudinary (VITE_CLOUDINARY_CLOUD_NAME o VITE_CLOUDINARY_UPLOAD_PRESET)"
    );
  }

  const file = dataUrlToFile(dataUrl, `footcare-${Date.now()}.png`);

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("folder", folder);

  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

  const response = await fetch(url, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Error subiendo a Cloudinary: ${error}`);
  }

  const data = await response.json();
  return data.secure_url as string;
}

/**
 * Sube un array de imágenes base64 a Cloudinary y devuelve las nuevas URLs.
 * Las URLs que ya no son base64 se mantienen sin cambios.
 */
export async function uploadImagesToCloudinary(
  urls: (string | undefined | null)[]
): Promise<string[]> {
  return Promise.all(
    urls.map((url) => (url ? uploadImageToCloudinary(url) : ""))
  );
}
