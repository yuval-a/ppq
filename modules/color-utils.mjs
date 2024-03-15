import config from './config.mjs';
const { RGB_WEIGHT_STANDARD, RGB_WEIGHTS } = config;

export function rgbToHsv(rgb) {
    // remove Alpha if exists
    rgb = rgb.toSpliced(3,1);
    // Normalize to 0,1
    rgb = rgb.map(c=> c/255);
    const minC = Math.min(...rgb);
    const maxC = Math.max(...rgb);
    const delta = maxC - minC;
    let H = 0;
    if (maxC !== minC) {
        switch (true) {
            case maxC === rgb[0]:
                H = 60 * (((rgb[1] - rgb[2]) / delta) % 6);
                break;
            case maxC === rgb[1]:
                H = 60 * (((rgb[2] - rgb[0]) / delta) + 2);
                break;
            case maxC === rgb[2]:
                H = 60 * (((rgb[0] - rgb[1]) / delta) + 4);
                break;
        }
    }
    if (H < 0) H++;
    
    const S = maxC === 0 ? 0 : (maxC - minC) / maxC;
    const V = maxC;

    return [H,S,V];
}

export function getHueFromRgb(rgb) {
    // remove Alpha if exists
    rgb = rgb.toSpliced(3,1);
    // Normalize to 0,1
    rgb = rgb.map(c=> c/255);
    const minC = Math.min(...rgb);
    const maxC = Math.max(...rgb);
    const delta = maxC - minC;
    let H = 0;
    if (maxC !== minC) {
        switch (true) {
            case maxC === rgb[0]:
                H = (60 * ((rgb[1] - rgb[2]) / delta) + 360) % 360;
                break;
            case maxC === rgb[1]:
                H = (60 * ((rgb[2] - rgb[0]) / delta) + 120) % 360;
                break;
            case maxC === rgb[2]:
                H = (60 * ((rgb[0] - rgb[1]) / delta) + 240) % 360;
                break;
        }        
    }
    return Math.round(H);
}

export function getLumaFromRgb(rgb) {
    // remove Alpha if exists
    rgb = rgb.toSpliced(3,1);
    const rgbWeights = RGB_WEIGHTS[RGB_WEIGHT_STANDARD];
    return (rgb[0] * rgbWeights.R) + (rgb[1] * rgbWeights.G) + (rgb[2] * rgbWeights.B);
}

export function rgbToYuv(rgb) {
    // remove Alpha if exists
    rgb = rgb.toSpliced(3,1);
    const [R, G, B] = rgb;
    return [
        Math.abs(Math.round(getLumaFromRgb(rgb))),
        Math.abs(Math.round((-0.14713*R) - (0.28886*G) + (0.436 * B))),
        Math.abs(Math.round((0.615*R) - (0.51499*G) - (0.10001 * B)))
    ];
}

export function yuvToRgb(yuv) {
    const [Y, U, V] = yuv;
    U -= 128;
    V -= 128;
    
    let R = Y + 1.402 * V;
    let G = Y - 0.344136 * U - 0.714136 * V;
    let B = Y + 1.772 * U;

    return [R, G, B];
}