console.log("Manga Translator content script loaded.");

const images = document.querySelectorAll("img");

console.log(`Found ${images.length} images on this page.`);

for (let i = 0; i < images.length; i++) {
    console.log(`Image ${i}:`);
    console.log("URL:", images[i].src);
    console.log("Width:", images[i].width);
    console.log("Height:", images[i].height);
    console.log("Alt text:", images[i].alt);

    const aspectRatio = images[i].width / images[i].height;
    console.log("Aspect ratio:", aspectRatio);

    if (
    images[i].width > 500 &&
    images[i].height > 500 &&
    aspectRatio >= 0.4 &&
    aspectRatio <= 1.0
) {
    console.log("Possible manga image:", images[i]);
}
}