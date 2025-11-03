import fs from "fs";
import sharp from "sharp";

async function getPixels(filePath: string): Promise<Pixel[]> {
    // Read the image file into a Buffer
    const imageData = fs.readFileSync(filePath);

    const { data, info } = await sharp(imageData)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    // Get the pixels
    const pixels: Pixel[] = [];
    for (let y = 0; y < info.height; y++) {
        for (let x = 0; x < info.width; x++) {
            const idx = (info.width * y + x) << 2;
            const pixel: Pixel = {
                red: data[idx],
                green: data[idx + 1],
                blue: data[idx + 2],
                alpha: data[idx + 3],
                id: y * info.width + x
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
    alpha: number,
    id: number
}

export { getPixels };