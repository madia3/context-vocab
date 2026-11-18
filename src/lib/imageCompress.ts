/**
 * Client-side image compression for user avatars.
 * Resizes and crops to a square (128x128), compresses to WebP/JPEG (~3-10KB).
 * Stores locally or client-side so Supabase 500MB storage quota is completely untouched (0 MB consumed).
 */

export interface CompressedImageResult {
  dataUrl: string;
  sizeKb: number;
  width: number;
  height: number;
}

export async function compressAvatarImage(
  file: File,
  maxDimension = 128,
  quality = 0.75
): Promise<CompressedImageResult> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('이미지 파일(PNG, JPG, WebP, GIF 등)만 선택할 수 있습니다.'));
      return;
    }

    // Limit original file size before compression to avoid browser freeze (max 20MB)
    if (file.size > 20 * 1024 * 1024) {
      reject(new Error('이미지 파일이 너무 큽니다. 20MB 이하의 이미지를 선택해 주세요.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          const width = img.width;
          const height = img.height;

          // Center-crop to square
          const minSide = Math.min(width, height);
          const sx = (width - minSide) / 2;
          const sy = (height - minSide) / 2;

          const canvas = document.createElement('canvas');
          canvas.width = maxDimension;
          canvas.height = maxDimension;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('브라우저 캔버스 생성에 실패했습니다.'));
            return;
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // Draw cropped center square into canvas
          ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, maxDimension, maxDimension);

          // Attempt WebP, fallback to JPEG
          let dataUrl = canvas.toDataURL('image/webp', quality);
          if (!dataUrl.startsWith('data:image/webp')) {
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }

          // Calculate approximate size in KB
          const base64Length = dataUrl.length - (dataUrl.indexOf(',') + 1);
          const sizeKb = Math.round(((base64Length * 0.75) / 1024) * 10) / 10;

          resolve({
            dataUrl,
            sizeKb,
            width: maxDimension,
            height: maxDimension,
          });
        } catch (err) {
          reject(err instanceof Error ? err : new Error('이미지 압축 처리 중 오류가 발생했습니다.'));
        }
      };
      img.onerror = () => reject(new Error('이미지를 해석할 수 없습니다. 다른 사진을 선택해 주세요.'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('파일을 읽는 중 오류가 발생했습니다.'));
    reader.readAsDataURL(file);
  });
}
