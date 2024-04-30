import {PNG} from "pngjs";
import fs from "fs";

function getPixels(filePath: string): Pixel[] {
    // Read the image file into a Buffer
    const imageData = fs.readFileSync(filePath);

    // Parse the image buffer
    const png = PNG.sync.read(imageData);

    // Get the pixels
    const pixels: Pixel[] = [];
    for (let y = 0; y < png.height; y++) {
        for (let x = 0; x < png.width; x++) {
            const idx = (png.width * y + x) << 2;
            const pixel: Pixel = {
                red: png.data[idx],
                green: png.data[idx + 1],
                blue: png.data[idx + 2],
                alpha: png.data[idx + 3]
            };
            pixels.push(pixel);
        }
    }

    return pixels;
}

export type Pixel = {
    red: number,
    green: number,
    blue: number,
    alpha: number
}

export { getPixels };