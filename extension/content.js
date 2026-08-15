console.log("Manga Translator content script loaded.");

const processedImages = new Set();

function processImage(image) {
    if (processedImages.has(image)) {
        return;
    }

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

                    // Create canvas

                    const canvas = document.createElement("canvas");
                    const context = canvas.getContext("2d");

                    canvas.width = loadedImage.naturalWidth;
                    canvas.height = loadedImage.naturalHeight;

                    console.log("Canvas created.");
                    console.log("Canvas width:", canvas.width);
                    console.log("Canvas height:", canvas.height);

                    context.drawImage(loadedImage, 0, 0);
                    console.log("Image drawn onto canvas.");

                    // Get pixel data

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

                    // Convert to grayscale

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

                    // Convert grayscale canvas to Blob

                    grayCanvas.toBlob((grayBlob) => {
                        console.log("Grayscale blob:", grayBlob);

                        if (!grayBlob) {
                            console.error("Failed to create grayscale blob.");
                            return;
                        }

                        console.log("Grayscale blob size:", grayBlob.size);
                        console.log("Grayscale blob type:", grayBlob.type);

                        const grayscaleURL = URL.createObjectURL(grayBlob);

                        console.log("Grayscale image URL:", grayscaleURL);

                        // Load processed image

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

// Initial scan
findImages();

// Watch for dynamically added images

const observer = new MutationObserver(() => {
    findImages();
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});

console.log("Image observer started.");