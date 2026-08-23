import { randomBytes } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { BackendUnavailableError, getAppUrl, isDemoMode, requireLiveBackend } from "@/lib/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const MEDIA_BUCKET = "media";

const CREATIVE_TYPES: Record<string, { ext: string; kind: "image" | "video"; maxBytes: number }> = {
  "image/jpeg": { ext: "jpg", kind: "image", maxBytes: 5 * 1024 * 1024 },
  "image/png": { ext: "png", kind: "image", maxBytes: 5 * 1024 * 1024 },
  "image/webp": { ext: "webp", kind: "image", maxBytes: 5 * 1024 * 1024 },
  "video/mp4": { ext: "mp4", kind: "video", maxBytes: 16 * 1024 * 1024 },
};

const LOGO_TYPES: Record<string, { ext: string; kind: "image"; maxBytes: number }> = {
  "image/jpeg": { ext: "jpg", kind: "image", maxBytes: 2 * 1024 * 1024 },
  "image/png": { ext: "png", kind: "image", maxBytes: 2 * 1024 * 1024 },
  "image/webp": { ext: "webp", kind: "image", maxBytes: 2 * 1024 * 1024 },
};

export type UploadedMedia = {
  url: string;
  path: string;
  mediaType: "image" | "video";
  fileName: string;
  demo: boolean;
};

function specFor(kind: "creative" | "logo", type: string) {
  const table = kind === "logo" ? LOGO_TYPES : CREATIVE_TYPES;
  const spec = table[type];
  if (!spec) {
    throw new Error(
      kind === "logo"
        ? "Use PNG, JPG ou WEBP no logo."
        : "Use JPG, PNG, WEBP ou MP4 (formato aceito pela Cloud API).",
    );
  }
  return spec;
}

export async function uploadRestaurantMedia(input: {
  restaurantId: string;
  file: File;
  kind: "creative" | "logo";
}): Promise<UploadedMedia> {
  const spec = specFor(input.kind, input.file.type);
  if (input.file.size > spec.maxBytes) {
    const mb = Math.round(spec.maxBytes / (1024 * 1024));
    throw new Error(`Arquivo grande demais. Máximo: ${mb} MB.`);
  }

  const bytes = Buffer.from(await input.file.arrayBuffer());
  const folder = input.kind === "logo" ? "logo" : "criativos";
  const fileName = `${Date.now()}-${randomBytes(4).toString("hex")}.${spec.ext}`;
  const objectPath = `${input.restaurantId}/${folder}/${fileName}`;

  if (isDemoMode()) {
    const dir = path.join(process.cwd(), "public", "uploads", folder);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, fileName), bytes);
    const publicPath = `/uploads/${folder}/${fileName}`;
    return {
      url: `${getAppUrl()}${publicPath}`,
      path: publicPath,
      mediaType: spec.kind,
      fileName: input.file.name,
      demo: true,
    };
  }

  requireLiveBackend();
  const admin = createSupabaseAdminClient();
  if (!admin) throw new BackendUnavailableError();

  const { error } = await admin.storage.from(MEDIA_BUCKET).upload(objectPath, bytes, {
    contentType: input.file.type,
    upsert: false,
  });

  if (error) {
    throw new Error(
      error.message.includes("Bucket not found")
        ? "Bucket de mídia ausente. Rode a migration 0013_media_storage.sql no Supabase."
        : error.message,
    );
  }

  const { data } = admin.storage.from(MEDIA_BUCKET).getPublicUrl(objectPath);
  return {
    url: data.publicUrl,
    path: objectPath,
    mediaType: spec.kind,
    fileName: input.file.name,
    demo: false,
  };
}
