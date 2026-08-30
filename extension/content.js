console.log("Manga Translator loaded.");

const processedImages = new WeakSet();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.action === "translatePage") {
        triggerTranslationForPage();
        sendResponse({ ok: true });
        return true;
    }

    return false;
});

const SETTINGS = {
    threshold: 128,
    regionSize: 50,
    minDarkPercentage: 5,
    maxDarkPercentage: 60,
    minRegionWidth: 5,
    minRegionHeight: 5,
    maxRegionWidth: 45,
    maxRegionHeight: 45,
    sourceLanguage: "jpn",
    targetLanguage: "en"
};

let GOOGLE_API_KEY = "";

chrome.storage.local.get(["googleTranslateApiKey"], result => {
    GOOGLE_API_KEY = result.googleTranslateApiKey || "";
    console.log("Google Translate API key loaded:", !!GOOGLE_API_KEY);
});

chrome.storage.onChanged.addListener(changes => {
    if (changes.googleTranslateApiKey) {
        GOOGLE_API_KEY = changes.googleTranslateApiKey.newValue || "";
    }
});

function triggerTranslationForPage() {
    const images = document.querySelectorAll("img");
    images.forEach(image => {
        delete image.dataset.mangaTranslatorProcessed;
        processImage(image, true);
    });
}

function isMangaCandidate(image, force = false) {
    if (!force && image.dataset.mangaTranslatorProcessed === "true") {
        return false;
    }

    if (!image.complete) {
        return false;
    }

    const rect = image.getBoundingClientRect();

    if (rect.width < 250 || rect.height < 250) {
        return false;
    }

    if (image.naturalWidth < 250 || image.naturalHeight < 250) {
        return false;
    }

    const aspectRatio = image.naturalWidth / image.naturalHeight;
    const visible = rect.top < window.innerHeight && rect.bottom > 0;

    return visible && aspectRatio < 1;
}

async function loadImageBlob(src) {
    try {
        const response = await fetch(src, {
            mode: "cors"
        });

        if (!response.ok) {
            throw new Error(`Image fetch failed: ${response.status}`);
        }

        return await response.blob();
    } catch (error) {
        console.warn("Direct image fetch failed, trying local proxy:", error);

        const proxyUrl = `http://localhost:3000/proxy-image?imageUrl=${encodeURIComponent(src)}`;
        const proxyResponse = await fetch(proxyUrl);

        if (!proxyResponse.ok) {
            throw new Error(`Proxy image fetch failed: ${proxyResponse.status}`);
        }

        return await proxyResponse.blob();
    }
}

function blobToImage(blob) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(blob);
        const image = new Image();

        image.onload = () => {
            URL.revokeObjectURL(url);
            resolve(image);
        };

        image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Failed to load image."));
        };

        image.src = url;
    });
}

function createCanvas(image) {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", {
        willReadFrequently: true
    });

    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;

    context.drawImage(image, 0, 0);

    return {
        canvas,
        context
    };
}

function convertToGrayscale(imageData, width, height) {
    const grayImageData = new ImageData(width, height);

    for (let i = 0; i < imageData.data.length; i += 4) {
        const red = imageData.data[i];
        const green = imageData.data[i + 1];
        const blue = imageData.data[i + 2];
        const alpha = imageData.data[i + 3];

        const gray = Math.round(
            0.299 * red +
            0.587 * green +
            0.114 * blue
        );

        grayImageData.data[i] = gray;
        grayImageData.data[i + 1] = gray;
        grayImageData.data[i + 2] = gray;
        grayImageData.data[i + 3] = alpha;
    }

    return grayImageData;
}

function findCandidateRegions(grayImageData, width, height) {
    const regions = [];

    for (let y = 0; y < height; y += SETTINGS.regionSize) {
        for (let x = 0; x < width; x += SETTINGS.regionSize) {
            const regionWidth = Math.min(
                SETTINGS.regionSize,
                width - x
            );

            const regionHeight = Math.min(
                SETTINGS.regionSize,
                height - y
            );

            let darkCount = 0;
            let pixelCount = 0;

            for (let regionY = y; regionY < y + regionHeight; regionY++) {
                for (let regionX = x; regionX < x + regionWidth; regionX++) {
                    const index =
                        (regionY * width + regionX) * 4;

                    const gray = grayImageData.data[index];

                    pixelCount++;

                    if (gray < SETTINGS.threshold) {
                        darkCount++;
                    }
                }
            }

            const darkPercentage =
                (darkCount / pixelCount) * 100;

            if (
                darkPercentage >= SETTINGS.minDarkPercentage &&
                darkPercentage <= SETTINGS.maxDarkPercentage
            ) {
                const region = findTightRegion(
                    grayImageData,
                    width,
                    x,
                    y,
                    regionWidth,
                    regionHeight,
                    darkPercentage
                );

                if (region) {
                    regions.push(region);
                    console.log("Accepted text region:", region);
                }
            }
        }
    }

    return regions;
}

function findTightRegion(
    grayImageData,
    imageWidth,
    x,
    y,
    regionWidth,
    regionHeight,
    darkPercentage
) {
    let minX = regionWidth;
    let minY = regionHeight;
    let maxX = 0;
    let maxY = 0;
    let found = false;

    for (let regionY = y; regionY < y + regionHeight; regionY++) {
        for (let regionX = x; regionX < x + regionWidth; regionX++) {
            const index =
                (regionY * imageWidth + regionX) * 4;

            const gray = grayImageData.data[index];

            if (gray < SETTINGS.threshold) {
                found = true;

                const localX = regionX - x;
                const localY = regionY - y;

                if (localX < minX) minX = localX;
                if (localX > maxX) maxX = localX;
                if (localY < minY) minY = localY;
                if (localY > maxY) maxY = localY;
            }
        }
    }

    if (!found) {
        return null;
    }

    const tightRegion = {
        x: x + minX,
        y: y + minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
        darkPercentage
    };

    if (
        tightRegion.width < SETTINGS.minRegionWidth ||
        tightRegion.height < SETTINGS.minRegionHeight ||
        tightRegion.width > SETTINGS.maxRegionWidth ||
        tightRegion.height > SETTINGS.maxRegionHeight
    ) {
        console.log("Rejected region:", tightRegion);
        return null;
    }

    return tightRegion;
}

function regionsOverlap(a, b, padding = 8) {
    return !(
        a.x + a.width + padding < b.x ||
        b.x + b.width + padding < a.x ||
        a.y + a.height + padding < b.y ||
        b.y + b.height + padding < a.y
    );
}

function mergeRegions(regions) {
    const result = [];

    for (const region of regions) {
        let merged = false;

        for (const existing of result) {
            if (regionsOverlap(existing, region)) {
                const minX = Math.min(existing.x, region.x);
                const minY = Math.min(existing.y, region.y);

                const maxX = Math.max(
                    existing.x + existing.width,
                    region.x + region.width
                );

                const maxY = Math.max(
                    existing.y + existing.height,
                    region.y + region.height
                );

                existing.x = minX;
                existing.y = minY;
                existing.width = maxX - minX;
                existing.height = maxY - minY;

                merged = true;
                break;
            }
        }

        if (!merged) {
            result.push({ ...region });
        }
    }

    return result;
}

function createOverlay(image, regions) {
    const container = document.createElement("div");

    container.className =
        "manga-translator-container";

    container.style.position = "relative";
    container.style.display = "inline-block";
    container.style.lineHeight = "0";

    image.parentNode.insertBefore(container, image);
    container.appendChild(image);

    const overlay = document.createElement("canvas");

    overlay.width = image.naturalWidth;
    overlay.height = image.naturalHeight;

    overlay.className =
        "manga-translator-detection-overlay";

    overlay.style.position = "absolute";
    overlay.style.left = "0";
    overlay.style.top = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.pointerEvents = "none";
    overlay.style.zIndex = "999998";

    const context = overlay.getContext("2d");

    context.strokeStyle = "red";
    context.lineWidth = Math.max(
        2,
        image.naturalWidth / 400
    );

    for (const region of regions) {
        context.strokeRect(
            region.x,
            region.y,
            region.width,
            region.height
        );
    }

    container.appendChild(overlay);

    return container;
}

function cropRegion(image, region) {
    const canvas = document.createElement("canvas");

    canvas.width = region.width;
    canvas.height = region.height;

    const context = canvas.getContext("2d");

    context.drawImage(
        image,
        region.x,
        region.y,
        region.width,
        region.height,
        0,
        0,
        region.width,
        region.height
    );

    return canvas;
}

async function loadTesseract() {
    if (typeof Tesseract !== "undefined") {
        return;
    }

    await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
        script.async = true;

        script.onload = () => {
            if (typeof Tesseract !== "undefined") {
                resolve();
            } else {
                reject(new Error("Tesseract.js failed to initialize."));
            }
        };

        script.onerror = () => {
            reject(new Error("Failed to load Tesseract.js from CDN."));
        };

        const target = document.head || document.documentElement;
        target.appendChild(script);
    });
}

async function recognizeText(canvas) {
    await loadTesseract();

    if (typeof Tesseract === "undefined") {
        throw new Error(
            "Tesseract.js was not loaded."
        );
    }

    console.log("Starting OCR...");

    const result = await Tesseract.recognize(
        canvas,
        SETTINGS.sourceLanguage,
        {
            logger: message => {
                if (message.status === "recognizing text") {
                    console.log(
                        `OCR progress: ${Math.round(message.progress * 100)}%`
                    );
                }
            }
        }
    );

    const text = result.data.text.trim();

    console.log("OCR result:", text);

    return text;
}

async function translateText(text) {
    if (!text) {
        return "";
    }

    if (!GOOGLE_API_KEY) {
        console.warn(
            "Google Translate API key has not been configured."
        );

        return "";
    }

    const response = await fetch(
        "https://translation.googleapis.com/language/translate/v2?key=" +
        encodeURIComponent(GOOGLE_API_KEY),
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                q: text,
                source: "ja",
                target: SETTINGS.targetLanguage,
                format: "text"
            })
        }
    );

    const data = await response.json();

    if (!response.ok) {
        console.error(
            "Google Translate error:",
            data
        );

        throw new Error(
            data.error?.message ||
            "Google Translate request failed."
        );
    }

    return data.data.translations[0].translatedText;
}

function createTranslationBox(
    container,
    region,
    translatedText,
    image
) {
    const box = document.createElement("div");

    box.className =
        "manga-translator-text-box";

    const scaleX =
        container.clientWidth / image.naturalWidth;

    const scaleY =
        container.clientHeight / image.naturalHeight;

    box.style.position = "absolute";
    box.style.left =
        region.x * scaleX + "px";
    box.style.top =
        region.y * scaleY + "px";
    box.style.width =
        region.width * scaleX + "px";
    box.style.minHeight =
        region.height * scaleY + "px";

    box.textContent = translatedText;

    box.style.background = "white";
    box.style.color = "black";
    box.style.borderRadius = "4px";
    box.style.padding = "3px";
    box.style.boxSizing = "border-box";
    box.style.fontFamily =
        "Arial, sans-serif";
    box.style.fontSize =
        Math.max(12, region.height * scaleY * 0.45) + "px";
    box.style.fontWeight = "bold";
    box.style.lineHeight = "1.1";
    box.style.textAlign = "center";
    box.style.overflow = "hidden";
    box.style.zIndex = "1000000";
    box.style.pointerEvents = "none";

    container.appendChild(box);
}

async function processRegions(
    originalImage,
    container,
    regions
) {
    for (const region of regions) {
        try {
            console.log(
                "Processing region:",
                region
            );

            const crop =
                cropRegion(
                    originalImage,
                    region
                );

            const text =
                await recognizeText(crop);

            if (!text) {
                console.log(
                    "No text found."
                );
                continue;
            }

            const translated =
                await translateText(text);

            if (!translated) {
                continue;
            }

            console.log(
                "Translated:",
                translated
            );

            createTranslationBox(
                container,
                region,
                translated,
                originalImage
            );
        } catch (error) {
            console.error(
                "Region processing failed:",
                error
            );
        }
    }
}

async function processImage(image, force = false) {
    if (!isMangaCandidate(image, force)) {
        return;
    }

    if (!force) {
        image.dataset.mangaTranslatorProcessed =
            "true";
    }

    console.log(
        "Processing manga image:",
        image.src
    );

    try {
        const sourceUrl = image.currentSrc || image.src;
        const blob = await loadImageBlob(sourceUrl);
        const loadedImage = await blobToImage(blob);

        const {
            canvas,
            context
        } = createCanvas(
            loadedImage
        );

        let imageData;

        try {
            imageData =
                context.getImageData(
                    0,
                    0,
                    canvas.width,
                    canvas.height
                );
        } catch (canvasError) {
            console.warn(
                "Skipping image because canvas is tainted or cross-origin restricted:",
                canvasError
            );
            return;
        }

        console.log(
            "Pixel data length:",
            imageData.data.length
        );

        const grayImageData =
            convertToGrayscale(
                imageData,
                canvas.width,
                canvas.height
            );

        console.log(
            "Grayscale conversion complete."
        );

        const regions =
            findCandidateRegions(
                grayImageData,
                canvas.width,
                canvas.height
            );

        console.log(
            "Candidate regions:",
            regions.length
        );

        const mergedRegions =
            mergeRegions(regions);

        console.log(
            "Merged regions:",
            mergedRegions.length
        );

        if (mergedRegions.length === 0) {
            console.log(
                "No candidate text regions found."
            );

            return;
        }

        const container =
            createOverlay(
                image,
                mergedRegions
            );

        console.log(
            "Red detection boxes displayed."
        );

        if (!GOOGLE_API_KEY) {
            console.warn(
                "OCR will run, but translation requires a Google Translate API key."
            );
        }

        await processRegions(
            loadedImage,
            container,
            mergedRegions
        );
    } catch (error) {
        console.error(
            "Image processing failed:",
            error
        );
    }
}

function findImages() {
    const images =
        document.querySelectorAll(
            "img"
        );

    console.log(
        `Found ${images.length} images on this page.`
    );

    images.forEach(
        processImage
    );
}

findImages();

const observer =
    new MutationObserver(() => {
        findImages();
    });

observer.observe(
    document.body,
    {
        childList: true,
        subtree: true
    }
);

console.log(
    "Image observer started."
);