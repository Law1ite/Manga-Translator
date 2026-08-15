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

    const isVisible =
        rect.top < window.innerHeight &&
        rect.bottom > 0;

    console.log("Displayed size:", rect.width, rect.height);
    console.log(
        "Natural size:",
        image.naturalWidth,
        image.naturalHeight
    );
    console.log("Aspect ratio:", aspectRatio);
    console.log("Visible:", isVisible);

    if (
        isVisible &&
        rect.width > 250 &&
        rect.height > 250 &&
        aspectRatio < 1
    ) {
        console.log("Possible manga image:", image.src);

        fetch(image.src)
            .then(response => {
                console.log("Image response:", response);
                console.log("Status:", response.status);

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

                    console.log(
                        "Natural width:",
                        loadedImage.naturalWidth
                    );

                    console.log(
                        "Natural height:",
                        loadedImage.naturalHeight
                    );

                    loadedImage.dataset.mangaTranslatorImage = "true";

                    console.log(
                        "Image ready for processing:",
                        loadedImage
                    );

                    // Create canvas
                    const canvas = document.createElement("canvas");

                    canvas.width = loadedImage.naturalWidth;
                    canvas.height = loadedImage.naturalHeight;

                    const context = canvas.getContext("2d");

                    // Draw image onto canvas
                    context.drawImage(
                        loadedImage,
                        0,
                        0
                    );

                    console.log("Canvas created.");
                    console.log("Canvas width:", canvas.width);
                    console.log("Canvas height:", canvas.height);

                    // Read pixel data
                    const imageData = context.getImageData(
                        0,
                        0,
                        canvas.width,
                        canvas.height
                    );

                    console.log("Pixel data:", imageData);
                    console.log("Pixel data length:",imageData.data.length);
                    const firstPixel = {
                                        red: imageData.data[0],
                                        green: imageData.data[1],
                                        blue: imageData.data[2],
                                        alpha: imageData.data[3]
                                    };

                    console.log("First pixel:", firstPixel);
                };

                loadedImage.onerror = () => {
                    console.error(
                        "Failed to load image from Blob URL."
                    );
                };

                loadedImage.src = imageURL;
            })
            .catch(error => {
                console.error(
                    "Failed to fetch image:",
                    error
                );
            });
    }
}

function findImages() {
    const images = document.querySelectorAll("img");

    console.log(
        `Found ${images.length} images on this page.`
    );

    images.forEach(image => {
        processImage(image);
    });
}

// Initial scan
findImages();

// Watch for images added later
const observer = new MutationObserver(() => {
    findImages();
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});

console.log("Image observer started.");