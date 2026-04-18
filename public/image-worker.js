self.onmessage = async (e) => {
  const { blob, maxWidth, maxHeight, quality, toType } = e.data;

  try {
    // Note: heic2any is not easily available in Workers without workarounds/bundling complexity.
    // For now, we handle the intensive canvas-based resizing in the worker if possible,
    // or we just process the canvas ops.
    // In a real production app, you might bundle heic2any or use an OffscreenCanvas.

    if (typeof OffscreenCanvas === 'undefined') {
      self.postMessage({ error: 'OffscreenCanvas not supported in this environment' });
      return;
    }

    const img = await createImageBitmap(blob);
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

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);

    const mainBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
    const mainBuffer = await mainBlob.arrayBuffer();

    // Placeholder
    const placeholderCanvas = new OffscreenCanvas(20, 20);
    const pCtx = placeholderCanvas.getContext('2d');
    pCtx.drawImage(img, 0, 0, 20, 20);
    const placeholderBlob = await placeholderCanvas.convertToBlob({ type: 'image/jpeg', quality: 0.1 });
    const placeholderBuffer = await placeholderBlob.arrayBuffer();

    self.postMessage({ 
      mainBuffer, 
      placeholderBuffer,
      mimeType: 'image/jpeg'
    }, [mainBuffer, placeholderBuffer]);

  } catch (err) {
    self.postMessage({ error: err.message });
  }
};
