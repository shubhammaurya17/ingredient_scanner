import heic2any from 'heic2any';

export async function resizeImage(file: File | string | Blob, maxWidth = 800, maxHeight = 800, quality = 0.7): Promise<{ main: string, placeholder: string }> {
  let blob: Blob;

  if (typeof file === 'string') {
    const res = await fetch(file);
    blob = await res.blob();
  } else {
    blob = file;
  }

  // Fallback if workers aren't usable or supported
  const fallbackResizing = (): Promise<{ main: string, placeholder: string }> => {
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
        if (!ctx) return reject(new Error('Canvas setup failed'));
        ctx.drawImage(img, 0, 0, width, height);
        const mainDataUrl = canvas.toDataURL('image/jpeg', quality);
        const pCanvas = document.createElement('canvas');
        pCanvas.width = 20; pCanvas.height = 20;
        const pCtx = pCanvas.getContext('2d');
        if (pCtx) pCtx.drawImage(canvas, 0, 0, 20, 20);
        const placeholderDataUrl = pCanvas.toDataURL('image/jpeg', 0.1);
        resolve({ main: mainDataUrl, placeholder: placeholderDataUrl });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Image load failed'));
      };
    });
  };

  // Try using Worker
  if (window.Worker && typeof OffscreenCanvas !== 'undefined') {
    return new Promise((resolve, reject) => {
      const worker = new Worker('/image-worker.js');
      worker.onmessage = (e) => {
        if (e.data.error) {
          fallbackResizing().then(resolve).catch(reject);
        } else {
          const { mainBuffer, placeholderBuffer } = e.data;
          const mainBlob = new Blob([mainBuffer], { type: 'image/jpeg' });
          const placeholderBlob = new Blob([placeholderBuffer], { type: 'image/jpeg' });

          const reader = new FileReader();
          reader.onloadend = () => {
            const mainBase64 = reader.result as string;
            const pReader = new FileReader();
            pReader.onloadend = () => {
              resolve({ main: mainBase64, placeholder: pReader.result as string });
            };
            pReader.readAsDataURL(placeholderBlob);
          };
          reader.readAsDataURL(mainBlob);
        }
        worker.terminate();
      };
      worker.onerror = (err) => {
        fallbackResizing().then(resolve).catch(reject);
        worker.terminate();
      };
      worker.postMessage({ blob, maxWidth, maxHeight, quality });
    });
  }

  return fallbackResizing();
}
