import heic2any from 'heic2any';

export async function resizeImage(file: File | string, maxWidth = 800, maxHeight = 800, quality = 0.7): Promise<string> {
  let blob: Blob;

  if (typeof file === 'string') {
    // If it's a base64 string
    const res = await fetch(file);
    blob = await res.blob();
  } else {
    blob = file;
  }

  // Handle HEIC/HEIF (common on iPhones)
  if (blob.type === 'image/heic' || blob.type === 'image/heif' || (file instanceof File && file.name.toLowerCase().endsWith('.heic'))) {
    try {
      const converted = await heic2any({
        blob,
        toType: 'image/jpeg',
        quality: quality
      });
      blob = Array.isArray(converted) ? converted[0] : converted;
    } catch (err) {
      console.error('HEIC conversion failed:', err);
      // Fallback to original blob, maybe the browser can handle it
    }
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    
    img.src = url;
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      // Use jpeg with specified quality to significantly reduce size
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image. Please ensure it is a valid image file.'));
    };
  });
}

export async function generatePlaceholder(file: File | string): Promise<string> {
  // Generate an extremely small, low-quality image for blur-up effect
  // 20x20 at 0.1 quality is usually < 1KB
  return resizeImage(file, 20, 20, 0.1);
}
