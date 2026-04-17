import heic2any from 'heic2any';

export async function resizeImage(file: File | string | Blob, maxWidth = 800, maxHeight = 800, quality = 0.7): Promise<{ main: string, placeholder: string }> {
  let blob: Blob;

  if (typeof file === 'string') {
    // If it's a base64 string
    const res = await fetch(file);
    blob = await res.blob();
  } else {
    blob = file;
  }

  // Handle HEIC/HEIF (common on iPhones)
  const isHeic = blob.type === 'image/heic' || blob.type === 'image/heif' || (file instanceof File && file.name.toLowerCase().endsWith('.heic'));
  
  if (isHeic) {
    // Check if browser might support HEIC natively (Safari/iOS)
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    
    if (!isSafari) {
      try {
        const converted = await heic2any({
          blob,
          toType: 'image/jpeg',
          quality: quality
        });
        blob = Array.isArray(converted) ? converted[0] : converted;
      } catch (err) {
        console.error('HEIC conversion failed:', err);
      }
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
      
      const mainDataUrl = canvas.toDataURL('image/jpeg', quality);
      
      // Generate placeholder from the already-resized canvas (saves processing original image twice)
      const placeholderCanvas = document.createElement('canvas');
      placeholderCanvas.width = 20;
      placeholderCanvas.height = 20;
      const pCtx = placeholderCanvas.getContext('2d');
      if (pCtx) {
        pCtx.drawImage(canvas, 0, 0, 20, 20);
      }
      const placeholderDataUrl = placeholderCanvas.toDataURL('image/jpeg', 0.1);

      resolve({ main: mainDataUrl, placeholder: placeholderDataUrl });
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image. Please ensure it is a valid image file.'));
    };
  });
}
