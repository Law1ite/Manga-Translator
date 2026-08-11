console.log("Manga Translator content script loaded.");

const images = document.querySelectorAll("img");

console.log(`Found ${images.length} images on this page.`);

for (let i = 0; i < images.length; i++) {
    console.log(`Image ${i}:`, images[i]);
}