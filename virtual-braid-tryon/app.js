const TRY_ON_ATTEMPT_LIMIT = 3;
const TRY_ON_ATTEMPT_WINDOW_MS = 24 * 60 * 60 * 1000;
const TRY_ON_ATTEMPT_KEY = "virtual_braid_tryon_attempts";
const PREPARED_MAX_DIMENSION = 1024;

const els = {
  selfieInput: document.getElementById("selfie-input"),
  styleSelect: document.getElementById("style-select"),
  faceCenterX: document.getElementById("face-center-x"),
  faceCenterY: document.getElementById("face-center-y"),
  faceRadiusX: document.getElementById("face-radius-x"),
  faceRadiusY: document.getElementById("face-radius-y"),
  faceFeather: document.getElementById("face-feather"),
  generateBtn: document.getElementById("generate-btn"),
  downloadBtn: document.getElementById("download-btn"),
  attempts: document.getElementById("attempts"),
  status: document.getElementById("status"),
  preview: document.getElementById("preview-image"),
  guideCanvas: document.getElementById("guide-canvas"),
};

let uploadedDataUrl = "";
let finalCompositeDataUrl = "";
let usageState = readTryOnUsageState();
let attemptsIntervalId;

function emptyTryOnUsageState() {
  return { attemptsUsed: 0, windowStartedAt: 0, resetAtMs: 0 };
}

function readTryOnUsageState() {
  const now = Date.now();
  const raw = localStorage.getItem(TRY_ON_ATTEMPT_KEY);
  if (!raw) return emptyTryOnUsageState();

  try {
    const parsed = JSON.parse(raw);
    const attemptsUsed = Number.isFinite(parsed.attemptsUsed) ? Math.max(0, Math.min(TRY_ON_ATTEMPT_LIMIT, Math.floor(parsed.attemptsUsed))) : 0;
    const windowStartedAt = Number.isFinite(parsed.windowStartedAt) ? Math.floor(parsed.windowStartedAt) : 0;
    const resetAtMs = windowStartedAt ? windowStartedAt + TRY_ON_ATTEMPT_WINDOW_MS : 0;

    if (!attemptsUsed || !windowStartedAt || now >= resetAtMs) {
      localStorage.removeItem(TRY_ON_ATTEMPT_KEY);
      return emptyTryOnUsageState();
    }

    return { attemptsUsed, windowStartedAt, resetAtMs };
  } catch {
    localStorage.removeItem(TRY_ON_ATTEMPT_KEY);
    return emptyTryOnUsageState();
  }
}

function writeTryOnUsageState(value) {
  if (!value.attemptsUsed || !value.windowStartedAt) {
    localStorage.removeItem(TRY_ON_ATTEMPT_KEY);
    return;
  }

  localStorage.setItem(
    TRY_ON_ATTEMPT_KEY,
    JSON.stringify({
      attemptsUsed: value.attemptsUsed,
      windowStartedAt: value.windowStartedAt,
    }),
  );
}

function consumeTryOnAttempt() {
  const now = Date.now();
  const current = readTryOnUsageState();
  const windowStartedAt = current.windowStartedAt || now;
  const next = {
    attemptsUsed: Math.min(TRY_ON_ATTEMPT_LIMIT, current.attemptsUsed + 1),
    windowStartedAt,
    resetAtMs: windowStartedAt + TRY_ON_ATTEMPT_WINDOW_MS,
  };
  writeTryOnUsageState(next);
  usageState = next;
  return next;
}

function formatTryOnResetCountdown(ms) {
  const totalMinutes = Math.max(1, Math.ceil(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function buildIdentityLockedBraidPrompt(selectedStyle) {
  return `Apply the selected braid hairstyle: ${selectedStyle}. Edit only the hair and braid region. Preserve the uploaded person's exact identity. Do not change the face. Do not alter skin tone, eyes, nose, lips, expression, makeup, eyebrows, cheeks, jawline, or face shape. Preserve the original pose, background, lighting, clothing, and jewellery. Produce a photorealistic premium salon-quality braid result. The final image must look natural and realistic, with only the hairstyle changed.`;
}

function currentFaceGuide() {
  return {
    centerX: Number(els.faceCenterX.value),
    centerY: Number(els.faceCenterY.value),
    radiusX: Number(els.faceRadiusX.value),
    radiusY: Number(els.faceRadiusY.value),
    feather: Number(els.faceFeather.value),
  };
}

async function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load image."));
    image.src = source;
  });
}

async function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error("Could not export canvas."));
      else resolve(blob);
    }, "image/png");
  });
}

async function preparePortraitImageAndMask(sourceDataUrl, faceGuide) {
  const image = await loadImage(sourceDataUrl);
  const scale = Math.min(1, PREPARED_MAX_DIMENSION / Math.max(image.width, image.height));
  const width = Math.max(256, Math.round(image.width * scale));
  const height = Math.max(256, Math.round(image.height * scale));

  const portraitCanvas = document.createElement("canvas");
  portraitCanvas.width = width;
  portraitCanvas.height = height;
  const portraitCtx = portraitCanvas.getContext("2d", { willReadFrequently: true });
  portraitCtx.drawImage(image, 0, 0, width, height);

  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = width;
  maskCanvas.height = height;
  const maskCtx = maskCanvas.getContext("2d");

  maskCtx.clearRect(0, 0, width, height);
  maskCtx.fillStyle = "rgba(0, 0, 0, 1)";
  maskCtx.fillRect(0, 0, width, height);

  const faceX = width * faceGuide.centerX;
  const faceY = height * faceGuide.centerY;
  const faceRX = width * faceGuide.radiusX;
  const faceRY = height * faceGuide.radiusY;

  const hairCenterY = faceY - faceRY * 0.7;
  const hairRX = faceRX * 2.2;
  const hairRY = faceRY * 2.25;

  maskCtx.globalCompositeOperation = "destination-out";
  maskCtx.beginPath();
  maskCtx.ellipse(faceX, hairCenterY, hairRX, hairRY, 0, 0, Math.PI * 2);
  maskCtx.fill();

  maskCtx.globalCompositeOperation = "source-over";
  maskCtx.fillStyle = "rgba(0, 0, 0, 1)";
  maskCtx.beginPath();
  maskCtx.ellipse(faceX, faceY, faceRX * 1.2, faceRY * 1.2, 0, 0, Math.PI * 2);
  maskCtx.fill();

  return {
    portraitBlob: await canvasToBlob(portraitCanvas),
    portraitDataUrl: portraitCanvas.toDataURL("image/png"),
    maskBlob: await canvasToBlob(maskCanvas),
    preparedWidth: width,
    preparedHeight: height,
  };
}

async function compositeOriginalFaceBackToResult(originalPreparedDataUrl, generatedDataUrl, faceGuide) {
  const [original, generated] = await Promise.all([loadImage(originalPreparedDataUrl), loadImage(generatedDataUrl)]);
  const width = generated.width;
  const height = generated.height;

  const originalCanvas = document.createElement("canvas");
  originalCanvas.width = width;
  originalCanvas.height = height;
  const originalCtx = originalCanvas.getContext("2d");
  originalCtx.drawImage(original, 0, 0, width, height);

  const faceMaskCanvas = document.createElement("canvas");
  faceMaskCanvas.width = width;
  faceMaskCanvas.height = height;
  const faceMaskCtx = faceMaskCanvas.getContext("2d");
  faceMaskCtx.clearRect(0, 0, width, height);
  faceMaskCtx.fillStyle = "black";
  faceMaskCtx.fillRect(0, 0, width, height);

  const feather = Math.max(6, Math.floor(faceGuide.feather));
  faceMaskCtx.filter = `blur(${feather}px)`;
  faceMaskCtx.fillStyle = "white";
  faceMaskCtx.beginPath();
  faceMaskCtx.ellipse(
    width * faceGuide.centerX,
    height * faceGuide.centerY,
    width * faceGuide.radiusX * 1.18,
    height * faceGuide.radiusY * 1.18,
    0,
    0,
    Math.PI * 2,
  );
  faceMaskCtx.fill();
  faceMaskCtx.filter = "none";

  const faceLayerCanvas = document.createElement("canvas");
  faceLayerCanvas.width = width;
  faceLayerCanvas.height = height;
  const faceLayerCtx = faceLayerCanvas.getContext("2d");
  faceLayerCtx.drawImage(originalCanvas, 0, 0);
  faceLayerCtx.globalCompositeOperation = "destination-in";
  faceLayerCtx.drawImage(faceMaskCanvas, 0, 0);

  const finalCanvas = document.createElement("canvas");
  finalCanvas.width = width;
  finalCanvas.height = height;
  const finalCtx = finalCanvas.getContext("2d");
  finalCtx.drawImage(generated, 0, 0, width, height);
  finalCtx.drawImage(faceLayerCanvas, 0, 0, width, height);

  return finalCanvas.toDataURL("image/png");
}

function setStatus(text, isError = false) {
  els.status.textContent = text;
  els.status.style.color = isError ? "#b12032" : "#68503a";
}

function renderGuide() {
  if (!uploadedDataUrl) return;
  loadImage(uploadedDataUrl).then((image) => {
    const canvas = els.guideCanvas;
    const ctx = canvas.getContext("2d");
    canvas.width = image.width;
    canvas.height = image.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0);

    const faceGuide = currentFaceGuide();
    ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.ellipse(
      canvas.width * faceGuide.centerX,
      canvas.height * faceGuide.centerY,
      canvas.width * faceGuide.radiusX,
      canvas.height * faceGuide.radiusY,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(2, Math.round(canvas.width / 240));
    ctx.beginPath();
    ctx.ellipse(
      canvas.width * faceGuide.centerX,
      canvas.height * faceGuide.centerY,
      canvas.width * faceGuide.radiusX,
      canvas.height * faceGuide.radiusY,
      0,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
  });
}

function renderAttempts() {
  usageState = readTryOnUsageState();
  const attemptsRemaining = Math.max(0, TRY_ON_ATTEMPT_LIMIT - usageState.attemptsUsed);

  if (attemptsRemaining > 0) {
    els.attempts.textContent = `You have ${attemptsRemaining} of ${TRY_ON_ATTEMPT_LIMIT} attempts remaining on this device.`;
    return;
  }

  const remaining = Math.max(0, usageState.resetAtMs - Date.now());
  const countdown = formatTryOnResetCountdown(remaining);
  els.attempts.textContent = `You have used all ${TRY_ON_ATTEMPT_LIMIT} attempts on this device. Your tries refresh in about ${countdown}.`;
}

async function onFileSelected(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    setStatus("Please upload an image file.", true);
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    uploadedDataUrl = String(reader.result || "");
    finalCompositeDataUrl = "";
    els.preview.src = uploadedDataUrl;
    els.downloadBtn.disabled = true;
    setStatus("Photo uploaded. Select a style and generate your Virtual Braid Try-On preview.");
    renderGuide();
  };
  reader.readAsDataURL(file);
}

async function generateTryOn() {
  usageState = readTryOnUsageState();
  if (usageState.attemptsUsed >= TRY_ON_ATTEMPT_LIMIT) {
    renderAttempts();
    setStatus(els.attempts.textContent, true);
    return;
  }

  if (!uploadedDataUrl) {
    setStatus("Please upload a clear selfie before generating.", true);
    return;
  }

  const style = els.styleSelect.value.trim();
  if (!style) {
    setStatus("Please select a braid style.", true);
    return;
  }

  els.generateBtn.disabled = true;
  setStatus("Generating your Virtual Braid Try-On preview...");

  try {
    const faceGuide = currentFaceGuide();
    const prepared = await preparePortraitImageAndMask(uploadedDataUrl, faceGuide);
    const prompt = buildIdentityLockedBraidPrompt(style);

    const payload = new FormData();
    payload.append("image", prepared.portraitBlob, "portrait.png");
    payload.append("mask", prepared.maskBlob, "hair-mask.png");
    payload.append("prompt", prompt);

    const response = await fetch("./api/tryon.php", {
      method: "POST",
      body: payload,
    });

    const responseData = await response.json().catch(() => ({}));
    if (!response.ok || !responseData.generatedImageUrl) {
      throw new Error(responseData.error || "Virtual Braid Try-On generation failed.");
    }

    const faceLockedComposite = await compositeOriginalFaceBackToResult(
      prepared.portraitDataUrl,
      responseData.generatedImageUrl,
      faceGuide,
    );

    finalCompositeDataUrl = faceLockedComposite;
    els.preview.src = faceLockedComposite;
    els.downloadBtn.disabled = false;
    consumeTryOnAttempt();
    renderAttempts();
    setStatus("Your Virtual Braid Try-On preview is ready.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Virtual Braid Try-On generation failed.";
    setStatus(message, true);
  } finally {
    els.generateBtn.disabled = false;
  }
}

function downloadFinalImage() {
  if (!finalCompositeDataUrl) return;
  const link = document.createElement("a");
  link.href = finalCompositeDataUrl;
  link.download = "virtual-braid-try-on-face-locked.png";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

els.selfieInput.addEventListener("change", (event) => onFileSelected(event.target.files?.[0]));
els.generateBtn.addEventListener("click", generateTryOn);
els.downloadBtn.addEventListener("click", downloadFinalImage);
[
  els.faceCenterX,
  els.faceCenterY,
  els.faceRadiusX,
  els.faceRadiusY,
  els.faceFeather,
].forEach((control) => control.addEventListener("input", renderGuide));

renderAttempts();
attemptsIntervalId = window.setInterval(renderAttempts, 30000);
window.addEventListener("beforeunload", () => {
  if (attemptsIntervalId) window.clearInterval(attemptsIntervalId);
});
