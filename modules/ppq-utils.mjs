
import { getLumaFromRgb } from './color-utils.mjs';
import config from './config.mjs';

const { FRAME_WIDTH, FRAME_SIZE, LUMA_THRESHOLD, RGB_DISTANCE_MAJOR_THRESHOLD, RGB_DISTANCE_MINOR_THRESHOLD } = config;
// Will contain an array of "quantized color channel values" - it is "stops" of values between 0 and 255:
// the value of Q - represents the division number, and the number of "stops" (items, or cells) - which will be Q-1.
// QS represents the difference between each stop, i.e. the multiples - the "gap" between each stop.
export let Q_COLORS;

// Same as Q_COLORS with keys and values replaced - i.e. the keys are "color channel values" and the values are "indexes", using for decoding.
export let Q_COLORS_SWAPPED;

export let Q; 
export let QS;
let defaultQ = config.START_Q;

const MIN_Q = config.MIN_Q; // Minimum possible is two colors [85, 170]
const MAX_Q = config.MAX_Q; // Maximum possible is Full spectrum

const RGB_WEIGHT_STANDARD = config.RGB_WEIGHT_STANDARD;

// Weights for each color channel
export const RW = config.RGB_WEIGHTS[RGB_WEIGHT_STANDARD].R;
export const GW = config.RGB_WEIGHTS[RGB_WEIGHT_STANDARD].G;
export const BW = config.RGB_WEIGHTS[RGB_WEIGHT_STANDARD].B;
// These represent RGB quantization "threshold" values for the first "stablization" step - the inter-frame comparison
// E.g. If the difference between R1 and R2 is under R_THRESHOLD - they will be considered "the same", and if all RGB differences are under their threshold
// The color will not be marked as "changed".
// Generally the Green threshold should be lower as the human eye is more sensitive to green changes.
// I found these two presets work: 32,16,32 or 16,8,16.

const RGB_DISTANCE_THRESHOLD = config.RGB_DISTANCE_BASE_THRESHOLD // The base threshold, reduced by a different weight for each color channel, according to RGB_WEIGHT_STANDARD
var R_THRESHOLD = Math.ceil(RGB_DISTANCE_THRESHOLD - (RW * RGB_DISTANCE_THRESHOLD));
var G_THRESHOLD = Math.ceil(RGB_DISTANCE_THRESHOLD - (GW * RGB_DISTANCE_THRESHOLD));
var B_THRESHOLD = Math.ceil(RGB_DISTANCE_THRESHOLD - (BW * RGB_DISTANCE_THRESHOLD));

console.log ("RGB Thresholds: ", R_THRESHOLD, G_THRESHOLD, B_THRESHOLD);

function clampAbs(value, min, max) {
    if (Math.abs(value) < min) return value < 0 ? 0-min : min;
    if (Math.abs(value) > max) return value < 0 ? 0-max : max;
    return value;
}

// Clamp value to be between min and max, inclusive.
export function clamp(value, min, max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

// Clamp value to be minimum the first Q_COLOR and maximum the last Q_COLOR
export function qclamp(value) {
    return clamp(value, Q_COLORS[0], Q_COLORS[Q_COLORS.length - 1]);
}

// Clamp index value to be between 0 and the last index of Q_COLORS
export function qiclamp(value) {
    return clamp(value, 0, Q_COLORS.length-1);
}

// Rounds a channel value (R/G/B) to the closest QS (color-quantization-stop).
function getRoundedChannel(channelValue) {
    channelValue = qclamp(channelValue);
    let qi = qiclamp(Math.round(channelValue / QS)-1);
    return Q_COLORS[qi];
}
export function rgbRound(pixel) {
    return [ 
        getRoundedChannel(pixel[0]),
        getRoundedChannel(pixel[1]),
        getRoundedChannel(pixel[2]),
        255
    ];
}

export function rgbRoundAdvanced(pixel, returnAlpha=true) {
    const newPixel = [0, 0, 0];
    if (returnAlpha) newPixel.push(255);
    const color = pixel.toSpliced(3,1);
    const majorIndex = color.indexOf(Math.max(...color));
    let majorValue = color[majorIndex];
    majorValue = getRoundedChannel(majorValue);


    const COMPOSITE_THRESHOLD = 16;
    const UPPER_THRESHOLD = majorValue - COMPOSITE_THRESHOLD;
    let qi;
    const QS =  Math.floor(COMPOSITE_THRESHOLD / 3);
    const Q_COLORS_CHANNEL = Array.from({length: 3}, (_, i) => clamp((i+1) * QS, QS, 256 - QS));

    color.forEach((c,i)=> {
        if (i === majorIndex) {
            newPixel[i] = majorValue;
        }
        else {
            // If close to major channel value - round it up to be same
            if (majorValue - c < COMPOSITE_THRESHOLD) {
                newPixel[i] = majorValue;
            }
            else if (c < UPPER_THRESHOLD) {
                newPixel[i] = UPPER_THRESHOLD;
            }
            else {
                qi = clamp(Math.ceil(c / QS)-1, 0, Q_COLORS_CHANNEL.length-1);
                newPixel[i] = Q_COLORS_CHANNEL[qi];
            }
        }
    });

    return newPixel;
}

export function arePixelsSimilar(pixel1, pixel2) {
    if (!Array.isArray(pixel1) || !Array.isArray(pixel2)) return false;
    return (Math.abs(pixel1[1] - pixel2[1]) < G_THRESHOLD &&
            Math.abs(pixel1[0] - pixel2[0]) < R_THRESHOLD &&
            Math.abs(pixel1[2] - pixel2[2]) < B_THRESHOLD);
}

export function arePixelsSimilarLuma(pixel1, pixel2) {
    if (!Array.isArray(pixel1) || !Array.isArray(pixel2)) return false;
    const luma1 = getLumaFromRgb(pixel1);
    const luma2 = getLumaFromRgb(pixel2);

    return (Math.abs(luma1 - luma2) < LUMA_THRESHOLD)
}

export function arePixelsSimilarAdvanced(pixel1, pixel2) {
    if (!Array.isArray(pixel1) || !Array.isArray(pixel2)) return false;
    pixel1 = pixel1.toSpliced(3,1);
    pixel2 = pixel2.toSpliced(3,1);
    const majorIndex1 = pixel1.indexOf(Math.max(...pixel1));
    const majorIndex2 = pixel2.indexOf(Math.max(...pixel2));

    if (majorIndex1 !== majorIndex2) return false;
    for (let i=0; i<3; i++) {
        if (i === majorIndex1) {
            if (Math.abs(pixel1[i] - pixel2[i]) > RGB_DISTANCE_MAJOR_THRESHOLD) return false;
        }
        else {
            if (Math.abs(pixel1[i] - pixel2[i]) > RGB_DISTANCE_MINOR_THRESHOLD) return false;
        }
    }

    return true;
}


// Initialize the Q_COLORS array
export function setQColors(setQ = defaultQ) {
    Q = setQ;
    QS = Math.floor(256 / Q);
    Q_COLORS = Array.from({length: Q-1}, (_, i) => clamp((i+1) * QS, QS, 256 - QS));
    Q_COLORS_SWAPPED = Object.fromEntries(Object.entries(Q_COLORS).map(([key, val])=> [val, Number(key)]));
    console.log (Q_COLORS);
    return [Q, QS];
}

export function getQChannelColorIndex(channelColor) {
    const indexCode = Q_COLORS_SWAPPED[channelColor];
    if (typeof indexCode === "undefined") {
        debugger;
        throw new Error(`Channel color ${channelColor} has no index! ImageData might not have been quantized`);
    }
    return indexCode;
}

export function getQColorByIndex(channelColorIndex) {
    const indexColor = Q_COLORS[channelColorIndex];
    if (typeof indexColor === "undefined") {
        debugger;
        throw new Error(`Channel color for index ${channelColorIndex} not found! There might be an error in IFrame encoding`);
    }
    return indexColor;
}

export function removeNoise(actionIndexes, pixelDiffs) {
    const ZERO_COUNT_FOR_NOISE = 50;
    let zeroCount = 0;
    let lastZeroCount;
    let a;
    for (let i=0, len=actionIndexes.length; i<len; i++) {
        a = actionIndexes[i];
        if (a === 0) {
            zeroCount++;
        }
        else if (a === 1) {
            lastZeroCount = zeroCount;
            zeroCount = 0;
            if (lastZeroCount >= ZERO_COUNT_FOR_NOISE) {
                const after = actionIndexes.slice(i+1, i+1+ZERO_COUNT_FOR_NOISE);
                // Check zeros after
                if (after.some(a=> a !== 0)) continue;
                // Check zeros before in same column;
                const colBefore = Array.from({length: ZERO_COUNT_FOR_NOISE}, (_, j) => {
                    const index = i-FRAME_WIDTH*(j+1);
                    return index >= 0 ?
                    actionIndexes[index] : undefined;
                })
                if (colBefore.some(a=> a !== 0)) continue;
                const colAfter  = Array.from({length: ZERO_COUNT_FOR_NOISE}, (_, j) => {
                    const index = i+FRAME_WIDTH*(j+1);
                    return index < FRAME_SIZE ?
                    actionIndexes[index] : undefined;
                });
                if (colAfter.some(a=> a !== 0)) continue;
                actionIndexes[i] = 0;
                pixelDiffs[i] = null;
            }
        }
    }
}

// ditherAmountsPerPixel is an array of length FRAME_SIZE where each value is a 3-value array 
export function updateDitherValues(ditherAmountsPerPixel, roundDiff, pixelIndex) {
    // If at last row - return (there's no bottom row to dither to)
    if (pixelIndex >= FRAME_SIZE - FRAME_WIDTH - 2) return;
    // If at end of row - return
    if (pixelIndex % FRAME_WIDTH-2 === 0) return;

    function addToDitherValuesAt(index, amounts) {
        const ditherValues = ditherAmountsPerPixel[index];
        ditherValues[0] += amounts[0];
        ditherValues[1] += amounts[1];
        ditherValues[2] += amounts[2];
    }

    /* Floyd-Steinberg (1/16)
        X   7
    3   5   1
    */
    addToDitherValuesAt(pixelIndex+1, roundDiff.map(d=> Math.floor(d * (7/16))));
    addToDitherValuesAt(pixelIndex+FRAME_WIDTH-1, roundDiff.map(d=> Math.floor(d * (3/16))));
    addToDitherValuesAt(pixelIndex+FRAME_WIDTH,   roundDiff.map(d=> Math.floor(d * (5/16))));
    addToDitherValuesAt(pixelIndex+FRAME_WIDTH+1, roundDiff.map(d=> Math.floor(d * (1/16))));

    /* Atkinson (1/8)
        X   1   1 
    1   1   1
    */
   /*
    addToDitherValuesAt(pixelIndex+1, roundDiff.map(d=> Math.floor(d * (1/8))));
    addToDitherValuesAt(pixelIndex+2, roundDiff.map(d=> Math.floor(d * (1/8))));
    addToDitherValuesAt(pixelIndex+FRAME_WIDTH-1, roundDiff.map(d=> Math.floor(d * (1/8))));
    addToDitherValuesAt(pixelIndex+FRAME_WIDTH,   roundDiff.map(d=> Math.floor(d * (1/8))));
    addToDitherValuesAt(pixelIndex+FRAME_WIDTH+1, roundDiff.map(d=> Math.floor(d * (1/8))));
    */

    /* Uniform (1/3)
        X 1
        1 1 
    */
    // addToDitherValuesAt(pixelIndex+1, roundDiff.map(d=> Math.floor(d * (1/3))));
    // addToDitherValuesAt(pixelIndex+FRAME_WIDTH,   roundDiff.map(d=> Math.floor(d * (1/3))));
    // addToDitherValuesAt(pixelIndex+FRAME_WIDTH+1, roundDiff.map(d=> Math.floor(d * (1/3))));
    
}

// It is neccesary to make this as a separate function, and not an implementation within ImageData,
// Because the color change resolvement is based on the quantized values

export function generateOutputImageDataRawFromData(quantizedImageData, pixelActions, pixelDiffs, roundingDiffs) {
    if (!pixelDiffs.length) return [];
    quantizedImageData.reset();
    const newRawImageData = [];
    let pixel, thisPixelIndex;
    while (pixel = quantizedImageData.next().value) {
        thisPixelIndex = quantizedImageData.currentPixelIndex - 1;
        if (pixelActions[thisPixelIndex] === 1) {
            const [rd, gd, bd] = pixelDiffs[thisPixelIndex];
            const [rr, gr, br] = roundingDiffs[thisPixelIndex];

            const ri = qiclamp(Q_COLORS_SWAPPED[pixel[0]] + rd);
            const gi = qiclamp(Q_COLORS_SWAPPED[pixel[1]] + gd);
            const bi = qiclamp(Q_COLORS_SWAPPED[pixel[2]] + bd);

            const newPixel = [
                clamp(Q_COLORS[ri] + rr, 0, 255), 
                clamp(Q_COLORS[gi] + gr, 0, 255), 
                clamp(Q_COLORS[bi] + br, 0, 255),
                255
            ];
            newRawImageData.push(...newPixel);
        }
        else {
            newRawImageData.push(...pixel);
        }
    }
    quantizedImageData.reset();
    return newRawImageData;
}

