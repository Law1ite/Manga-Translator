console.log("Manga Translator content script loaded.");

const processedImages = new Set();

function processImage(image) {
    if (processedImages.has(image)) return;

    processedImages.add(image);

    console.log("Processing image:", image.src);

    const rect = image.getBoundingClientRect();
    const aspectRatio = image.width / image.height;
    const isVisible = rect.top < window.innerHeight && rect.bottom > 0;

    console.log("Displayed size:", rect.width, rect.height);
    console.log("Natural size:", image.naturalWidth, image.naturalHeight);
    console.log("Aspect ratio:", aspectRatio);
    console.log("Visible:", isVisible);

    if (isVisible && rect.width > 250 && rect.height > 250 && aspectRatio < 1) {
        console.log("Possible manga image:", image.src);

        fetch(image.src)
            .then(response => {
                console.log("Image response:", response);
                console.log("Status:", response.status);

                if (!response.ok) {
                    throw new Error(`Image fetch failed: ${response.status}`);
                }

                return response.blob();
            })
            .then(blob => {
                console.log("Image blob:", blob);
                console.log("Blob size:", blob.size);
                console.log("Blob type:", blob.type);

                const imageURL = URL.createObjectURL(blob);
                console.log("Temporary image URL:", imageURL);

                const loadedImage = new Image();

                loadedImage.onload = () => {
                    console.log("Image loaded successfully.");
                    console.log("Natural width:", loadedImage.naturalWidth);
                    console.log("Natural height:", loadedImage.naturalHeight);

                    loadedImage.dataset.mangaTranslatorImage = "true";
                    console.log("Image ready for processing:", loadedImage);

                    const canvas = document.createElement("canvas");
                    const context = canvas.getContext("2d");

                    canvas.width = loadedImage.naturalWidth;
                    canvas.height = loadedImage.naturalHeight;

                    console.log("Canvas created.");
                    console.log("Canvas width:", canvas.width);
                    console.log("Canvas height:", canvas.height);

                    context.drawImage(loadedImage, 0, 0);
                    console.log("Image drawn onto canvas.");

                    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

                    console.log("Pixel data:", imageData);
                    console.log("Pixel data length:", imageData.data.length);

                    const firstPixel = {
                        red: imageData.data[0],
                        green: imageData.data[1],
                        blue: imageData.data[2],
                        alpha: imageData.data[3]
                    };

                    console.log("First pixel:", firstPixel);

                    const grayCanvas = document.createElement("canvas");
                    grayCanvas.width = canvas.width;
                    grayCanvas.height = canvas.height;

                    const grayContext = grayCanvas.getContext("2d");
                    const grayImageData = grayContext.createImageData(canvas.width, canvas.height);

                    for (let i = 0; i < imageData.data.length; i += 4) {
                        const red = imageData.data[i];
                        const green = imageData.data[i + 1];
                        const blue = imageData.data[i + 2];
                        const alpha = imageData.data[i + 3];

                        const gray = Math.round(0.299 * red + 0.587 * green + 0.114 * blue);

                        grayImageData.data[i] = gray;
                        grayImageData.data[i + 1] = gray;
                        grayImageData.data[i + 2] = gray;
                        grayImageData.data[i + 3] = alpha;
                    }

                    grayContext.putImageData(grayImageData, 0, 0);

                    console.log("Grayscale conversion complete.");

                    let darkPixels = 0;
                    let lightPixels = 0;

                    for (let i = 0; i < grayImageData.data.length; i += 4) {
                        const gray = grayImageData.data[i];

                        if (gray < 128) {
                            darkPixels++;
                        } else {
                            lightPixels++;
                        }
                    }

                    const totalPixels = grayImageData.data.length / 4;

                    console.log("Total pixels:", totalPixels);
                    console.log("Dark pixels:", darkPixels);
                    console.log("Light pixels:", lightPixels);
                    console.log("Dark pixel percentage:", (darkPixels / totalPixels) * 100);

                    const threshold = 128;

                    let minX = grayCanvas.width;
                    let minY = grayCanvas.height;
                    let maxX = 0;
                    let maxY = 0;
                    let foundDarkPixel = false;

                    for (let y = 0; y < grayCanvas.height; y++) {
                        for (let x = 0; x < grayCanvas.width; x++) {
                            const index = (y * grayCanvas.width + x) * 4;
                            const gray = grayImageData.data[index];

                            if (gray < threshold) {
                                foundDarkPixel = true;

                                if (x < minX) minX = x;
                                if (x > maxX) maxX = x;
                                if (y < minY) minY = y;
                                if (y > maxY) maxY = y;
                            }
                        }
                    }

                    if (foundDarkPixel) {
                        const width = maxX - minX + 1;
                        const height = maxY - minY + 1;

                        console.log("Dark pixel boundary found.");
                        console.log("Min X:", minX);
                        console.log("Min Y:", minY);
                        console.log("Max X:", maxX);
                        console.log("Max Y:", maxY);
                        console.log("Bounding box width:", width);
                        console.log("Bounding box height:", height);
                    } else {
                        console.log("No dark pixels found.");
                    }

                    const regionSize = 50;
                    const minDarkPercentage = 5;
                    const maxDarkPercentage = 60;
                    const possibleTextRegions = [];

                    for (let y = 0; y < grayCanvas.height; y += regionSize) {
                        for (let x = 0; x < grayCanvas.width; x += regionSize) {
                            let darkCount = 0;
                            let pixelCount = 0;

                            const regionWidth = Math.min(regionSize, grayCanvas.width - x);
                            const regionHeight = Math.min(regionSize, grayCanvas.height - y);

                            for (let regionY = y; regionY < y + regionHeight; regionY++) {
                                for (let regionX = x; regionX < x + regionWidth; regionX++) {
                                    const index = (regionY * grayCanvas.width + regionX) * 4;
                                    const gray = grayImageData.data[index];

                                    pixelCount++;

                                    if (gray < threshold) {
                                        darkCount++;
                                    }
                                }
                            }

                            const darkPercentage = (darkCount / pixelCount) * 100;

                            console.log(`Region (${x}, ${y}) - Dark pixels: ${darkPercentage.toFixed(2)}%`);

                            if (darkPercentage >= minDarkPercentage && darkPercentage <= maxDarkPercentage) {
                                const region = {
                                    x: x,
                                    y: y,
                                    width: regionWidth,
                                    height: regionHeight,
                                    darkPercentage: darkPercentage
                                };

                                possibleTextRegions.push(region);
                                console.log("Possible text region:", region);
                            }
                        }
                    }

                    console.log("Total possible text regions:", possibleTextRegions.length);

                    const detectionCanvas = document.createElement("canvas");
                    detectionCanvas.width = grayCanvas.width;
                    detectionCanvas.height = grayCanvas.height;

                    const detectionContext = detectionCanvas.getContext("2d");

                    detectionContext.drawImage(grayCanvas, 0, 0);

                    console.log("Detection canvas created.");

                    detectionContext.strokeStyle = "red";
                    detectionContext.lineWidth = 2;

                    possibleTextRegions.forEach(region => {
                        detectionContext.strokeRect(region.x, region.y, region.width, region.height);
                    });

                    console.log("Detection regions drawn.");

                    const overlayURL = detectionCanvas.toDataURL("image/png");

                    const overlay = document.createElement("img");
                    overlay.src = overlayURL;
                    overlay.style.position = "absolute";
                    overlay.style.left = "0";
                    overlay.style.top = "0";
                    overlay.style.width = "100%";
                    overlay.style.height = "100%";
                    overlay.style.pointerEvents = "none";
                    overlay.style.zIndex = "999999";

                    const imageContainer = document.createElement("div");
                    imageContainer.style.position = "relative";
                    imageContainer.style.width = image.offsetWidth + "px";
                    imageContainer.style.height = image.offsetHeight + "px";

                    image.parentNode.insertBefore(imageContainer, image);
                    imageContainer.appendChild(image);
                    imageContainer.appendChild(overlay);

                    console.log("Detection overlay displayed.");

                    grayCanvas.toBlob(grayBlob => {
                        console.log("Grayscale blob:", grayBlob);

                        if (!grayBlob) {
                            console.error("Failed to create grayscale blob.");
                            return;
                        }

                        console.log("Grayscale blob size:", grayBlob.size);
                        console.log("Grayscale blob type:", grayBlob.type);

                        const grayscaleURL = URL.createObjectURL(grayBlob);

                        console.log("Grayscale image URL:", grayscaleURL);

                        const processedImage = new Image();

                        processedImage.onload = () => {
                            console.log("Processed image loaded successfully.");
                            console.log("Processed image width:", processedImage.naturalWidth);
                            console.log("Processed image height:", processedImage.naturalHeight);
                        };

                        processedImage.onerror = () => {
                            console.error("Failed to load processed grayscale image.");
                        };

                        processedImage.src = grayscaleURL;
                    }, "image/png");
                };

                loadedImage.onerror = () => {
                    console.error("Failed to load image from Blob URL.");
                };

                loadedImage.src = imageURL;
            })
            .catch(error => {
                console.error("Failed to fetch image:", error);
            });
    }
}

function findImages() {
    const images = document.querySelectorAll("img");

    console.log(`Found ${images.length} images on this page.`);

    images.forEach(image => {
        processImage(image);
    });
}

findImages();

const observer = new MutationObserver(() => {
    findImages();
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});

console.log("Image observer started.");