console.log("Manga Translator content script loaded.");

const images = document.querySelectorAll("img");

console.log(`Found ${images.length} images on this page.`);

const candidates = [];

for (let i = 0; i < images.length; i++) {
    console.log("Image", i);

    console.log("URL:", images[i].src);
    console.log("Width:", images[i].width);
    console.log("Height:", images[i].height);
    console.log("Natural width:", images[i].naturalWidth);
    console.log("Natural height:", images[i].naturalHeight);

    const aspectRatio = images[i].width / images[i].height;
    console.log("Aspect ratio:", aspectRatio);

    const rect = images[i].getBoundingClientRect();

    const isVisible = rect.top < window.innerHeight && rect.bottom > 0;

    console.log("Position:", rect.x, rect.y);
    console.log("Displayed size:", rect.width, rect.height);
    console.log("Visible:", isVisible);

    if (
        isVisible &&
        rect.width > 250 &&
        rect.height > 250 &&
        aspectRatio < 1
    ) {
        candidates.push(images[i]);
        console.log("Possible manga image:", i);
    }
}

console.log("Total candidates:", candidates.length);