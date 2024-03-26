import config from './config.mjs';
const { 
    COLOR_DISTANCE_METHOD, 
    USE_ADVANCED_DISTANCE_RGB, 
    RGB_DISTANCE_BASE_THRESHOLD, 
    MAX_RGB_DIFF_FOR_SMOOTH_GRADIENT, 
    MAX_LUMA_DIFF_FOR_SMOOTH_GRADIENT, 
    LUMA_THRESHOLD,
    NORMALIZE_ADAPT 
} = config;
import { 
    rgbRound,
    clamp,
    qclamp, 
    qiclamp, 
    Q_COLORS, 
    Q_COLORS_SWAPPED,
    QS, 
    arePixelsSimilar,
    arePixelsSimilarAdvanced,
    arePixelsSimilarLuma,
    RW, GW, BW, updateDitherValues
} from './ppq-utils.mjs';

const { FRAME_WIDTH, FRAME_HEIGHT, FRAME_SIZE } = config;

const YELLOW = [255, 255, 0];
const RED = [255, 0, 0];

// can be "single" (show any changed pixel as red), 
// or "transition" - represent the amount of change with a color from yellow to red
const changeVisualizationMode = config.DIFF_VISUAL_MODE; 


export default {
    // The indexes represent the index that calling next() will return.
    currentRawPixelIndex: 0, // Raw index (e.g. an index where index, index+1, index+2, index+3 will be RGBA)
    currentPixelIndex: 0, // Basically Raw index / 4, the actual pixel index (total pixels = width * height)

    // NOTE: the index values above mark the index of the pixel that a call to next() will return!
    // So, if you want the index of the pixel that you just acquired with a call to next() - you should:
    // subtract 1 from currentPixelIndex, subtract 4 from currentRawPixelIndex
    next: function() {
        if (this.currentRawPixelIndex < this.data.length) {
            let nextValue = { 
                done: false,
                value: [this.data[this.currentRawPixelIndex], this.data[this.currentRawPixelIndex+1], this.data[this.currentRawPixelIndex+2], this.data[this.currentRawPixelIndex+3]]
            };

            this.currentPixelIndex++;
            this.currentRawPixelIndex += 4;
    
            return nextValue;
        }
        else {
            return { done: true };
        }
    },
    reset: function(toOffset=0) {
        if (!toOffset) {
            this.currentPixelIndex = 0;
            this.currentRawPixelIndex = 0;
        }
        else {
            this.currentPixelIndex = toOffset;
            this.currentRawPixelIndex = toOffset*4;
        }
    },
    goToRawIndex: function(toOffset) {
        if (toOffset > this.data.length || toOffset < 0) {
            console.warn (`goToRawIndex ${toOffset} is out of bounds!`);
            return;
        }
        if (toOffset % 4 !== 0 ) {
            console.warn (`goToRawIndex ${toOffset} is not a multiple of 4!`);
            return;
        }
        this.currentRawPixelIndex = toOffset;
        this.currentPixelIndex = toOffset/4;
    },
    getPixelAt: function(pixelIndex) {
        const offset = pixelIndex * 4;
        if (offset < 0 || offset > this.data.length-1) return undefined;
        return this.data.subarray(offset, offset+4);
    },
    goBack(howMuch=1) {
        if (this.currentPixelIndex - howMuch < 0) {
            console.warn(`Tried to go back beyond first pixel of image, with goBack(${howMuch}`);
            return;
        }
        this.currentPixelIndex -= howMuch;
        this.currentRawPixelIndex = this.currentPixelIndex * 4;
    },
    goToNextRowBelow(fromOffsetIndex) {
        if (typeof fromOffsetIndex === "undefined") fromOffsetIndex = this.currentPixelIndex;
        if (((fromOffsetIndex + FRAME_WIDTH) * 4) > this.data.length-4) {
            // console.warn(`Tried to go beyond data length of image, with goToNextRowBelow, currentPixelIndex: (${this.currentPixelIndex}`);
            return false;
        }
        this.currentPixelIndex = fromOffsetIndex + FRAME_WIDTH;
        this.currentRawPixelIndex = this.currentPixelIndex * 4;
        return true;
    },
    goToPrevRowAbove() {
        if (this.currentPixelIndex - FRAME_WIDTH < 0) {
            console.warn(`Tried to go beyond data length of image, with goToPrevRowAbove, currentPixelIndex: (${this.currentPixelIndex}`);
            return;
        }
        this.currentPixelIndex -= FRAME_WIDTH;
        this.currentRawPixelIndex = this.currentPixelIndex * 4;

    },
    quantize: function() {
        const newImageDataRaw = [];
        const rounds = [];
        this.reset();
        let pixel, rgbRounded, roundDiff;
        while (pixel = this.next().value) {
            rgbRounded = rgbRound(pixel);
            newImageDataRaw.push(...rgbRounded);

            roundDiff = [
                pixel[0] - rgbRounded[0],
                pixel[1] - rgbRounded[1],
                pixel[2] - rgbRounded[2],
            ];
            rounds.push(roundDiff);
        }
        this.data.set(new Uint8ClampedArray(newImageDataRaw));
        this.quantizedData = new Uint8ClampedArray(newImageDataRaw);
        this.reset();
        return rounds;
    },
    quantizeWithDither: function() {
        const newImageDataRaw = [];
        this.reset();
        let pixel, rgbRounded, roundDiff;
        let ditherAddAmounts, ditherAddPerIndex = Array.from({length: FRAME_SIZE}, ()=> [0, 0, 0]);
        let thisPixelIndex;
        while (pixel = this.next().value) {
            thisPixelIndex = this.currentPixelIndex-1;
            ditherAddAmounts = ditherAddPerIndex[thisPixelIndex];
            pixel[0] = clamp(pixel[0] + ditherAddAmounts[0], 0, 255);
            pixel[1] = clamp(pixel[1] + ditherAddAmounts[1], 0, 255);
            pixel[2] = clamp(pixel[2] + ditherAddAmounts[2],0, 255);

            rgbRounded = rgbRound(pixel);
            roundDiff = [
                pixel[0] - rgbRounded[0],
                pixel[1] - rgbRounded[1],
                pixel[2] - rgbRounded[2],
            ];
            newImageDataRaw.push(...rgbRounded);

            updateDitherValues(ditherAddPerIndex, roundDiff, thisPixelIndex);
        }
        this.data.set(new Uint8ClampedArray(newImageDataRaw));
        this.reset();
    },
    brighten: function() {
        let pixel;
        const newImageDataRaw = [];
        this.reset();
        while (pixel = this.next().value) {
            newImageDataRaw.push(
                pixel[0] >= 240 ? pixel[0] : pixel[0] + 16,
                pixel[1] >= 240 ? pixel[1] : pixel[1] + 16,
                pixel[2] >= 240 ? pixel[2] : pixel[2] + 16,
                255
            )
        }
        this.data.set(new Uint8ClampedArray(newImageDataRaw));

        this.reset();
    },
    // Mark alpha as 0 in at index (RAW index! not "pixel number index")
    // Used for marking pixels that should be skipped
    wipePixel(at) {
        if (at < 0 || at > this.data.length) {
            console.warn ("Tried to wipe pixel out of bounds of image data");
            return;
        }
        this.data.set([0], at+3);
    },
    // Returns a map of the differences between neighbouring pixels
    getAllColorDiffs: function() {
        let pixel, prevPixel = this.next().value;
        const diffs = [];
        while (pixel = this.next().value) {
            diffs.push([
                prevPixel[0] - pixel[0],
                prevPixel[1] - pixel[1],
                prevPixel[2] - pixel[2]
            ]);
            prevPixel = pixel;
        }
        return diffs;
    },
    sharpen: function(convolutionMatrix) {
        var wi;
        const sharpeningValues = Array.from({length: FRAME_SIZE}, ()=> [0,0,0]);
         // If at last row - return (there's no bottom row to dither to)

         const addWeightToPixelColor = (pixel, weight)=> {
            pixel[0] += pixel[0] * weight;
            pixel[1] += pixel[1] * weight;
            pixel[2] += pixel[2] * weight;
         }
         const addWeightedPixelToSharpeningValues = (wpixel, index)=> {
            sharpeningValues[index][0] += wpixel[0];
            sharpeningValues[index][1] += wpixel[1];
            sharpeningValues[index][2] += wpixel[2];
         }


         const addWeightsToRowFrom = (startIndex)=> {
            let index = startIndex;
            for (let i=index; i<index+3; i++) {
                let pixel = this.getPixelAt(i);
                if (pixel) {
                    addWeightToPixelColor(pixel, convolutionMatrix[wi++]);
                    addWeightedPixelToSharpeningValues(pixel, i);
                }
            }
         }

         function addSharpeningValuesAt(pixelIndex) {
            wi = 0;
            addWeightsToRowFrom(pixelIndex-FRAME_WIDTH-1); // toop
            addWeightsToRowFrom(pixelIndex-1); // center
            addWeightsToRowFrom(pixelIndex+FRAME_WIDTH-1); // bottom
         }

         this.reset();
         let pixel;
         while (pixel = this.next().value) {
            addSharpeningValuesAt(this.currentPixelIndex-1);
         }
         const newImageDataRaw = [];
         this.reset();
         let sharpening;
         while (pixel = this.next().value) {
            sharpening = sharpeningValues[this.currentPixelIndex-1];
            pixel[0] += qclamp(sharpening[0]);
            pixel[1] += qclamp(sharpening[1]);
            pixel[2] += qclamp(sharpening[2]);
            newImageDataRaw.push(...pixel);
         }
         this.data.set(newImageDataRaw, 0);
         this.reset();
    },
    // Inter-frame smooth
    smoothComparedTo: function(imageDataCompare, dither=false) {
        const newImageDataRaw = [];
        let lastDiff = Infinity;
        let prevPixel;
        let thisPixel, otherPixel, newPixel, ditherAddAmounts;
        let pixelDiff, ditherAddPerIndex = Array.from({length: FRAME_SIZE}, ()=> [0, 0, 0]);
        let currentPixelIndex;
        this.reset();
        imageDataCompare.reset();
        while (thisPixel = this.next().value) {
            if (prevPixel) {
                /*
                lastDiff = Math.sqrt( 
                    Math.abs(thisPixel[0] - prevPixel[0])**2 +
                    Math.abs(thisPixel[1] - prevPixel[1])**2 +
                    Math.abs(thisPixel[2] - prevPixel[2])**2
                );
                */
                lastDiff = Math.abs(Math.round(thisPixel.toSpliced(3,1).avg() - prevPixel.toSpliced(3,1).avg()));
            }
            currentPixelIndex = this.currentPixelIndex-1;
            // The previous frame's pixel on the same index
            otherPixel = imageDataCompare.next().value;
            if (COLOR_DISTANCE_METHOD === "luma") {
                if (NORMALIZE_ADAPT && lastDiff < MAX_LUMA_DIFF_FOR_SMOOTH_GRADIENT) 
                    newPixel = arePixelsSimilarLuma(thisPixel, otherPixel, LUMA_THRESHOLD * 0.50) ? otherPixel : thisPixel;
                else
                    newPixel = arePixelsSimilarLuma(thisPixel, otherPixel) ? otherPixel : thisPixel;

            }
            else if (COLOR_DISTANCE_METHOD === "RGB") {
                if (USE_ADVANCED_DISTANCE_RGB) 
                    newPixel = arePixelsSimilarAdvanced(thisPixel, otherPixel) ? otherPixel : thisPixel;
                else {
                    // Adapt the distance function to make it more aggressive - if we are in a smooth gradient section
                    if (NORMALIZE_ADAPT && lastDiff < MAX_RGB_DIFF_FOR_SMOOTH_GRADIENT) 
                        newPixel = arePixelsSimilar(thisPixel, otherPixel, Math.round(RGB_DISTANCE_BASE_THRESHOLD * 0.50)) ? otherPixel : thisPixel;
                    else
                        newPixel = arePixelsSimilar(thisPixel, otherPixel) ? otherPixel : thisPixel;
                }
            }
            if (dither) {
                pixelDiff = [
                    newPixel[0] - thisPixel[0],
                    newPixel[1] - thisPixel[1],
                    newPixel[2] - thisPixel[2],
                ];
                ditherAddAmounts = ditherAddPerIndex[currentPixelIndex];
                newPixel[0] = qclamp(newPixel[0] + ditherAddAmounts[0]);
                newPixel[1] = qclamp(newPixel[1] + ditherAddAmounts[1]);
                newPixel[2] = qclamp(newPixel[2] + ditherAddAmounts[2]);
                updateDitherValues(ditherAddPerIndex, pixelDiff, currentPixelIndex);
            }

            prevPixel = thisPixel;
            newImageDataRaw.push(...newPixel);
        }
        this.data.set(new Uint8ClampedArray(newImageDataRaw));
        imageDataCompare.reset();
        this.reset();
    },
    // Intra-frame smooth - not giving good results - unused
    smoothSelf: function() {
        let thisPixel, otherPixel, currentRawPixelIndex, pixelBelowIndex;
        this.reset();
        while (thisPixel = this.next().value) {
            currentRawPixelIndex = this.currentRawPixelIndex;
            otherPixel = this.data.subarray(currentRawPixelIndex, currentRawPixelIndex+4);
            if (arePixelsSimilar(thisPixel, otherPixel)) {
                this.data.set(thisPixel, currentRawPixelIndex);
            }
            // Compare to pixel directly below thisPixel
            const pixelBelowIndexRaw = ((this.currentRawPixelIndex-4) + (FRAME_WIDTH * 4));
            if (pixelBelowIndexRaw < this.data.length) {
                this.goToRawIndex(pixelBelowIndexRaw);
                otherPixel = this.next().value;
                // If pixel below is similar - set it to current pixel color
                if (otherPixel && arePixelsSimilar(thisPixel, otherPixel)) {
                    this.data.set(thisPixel, this.currentRawPixelIndex-4);
                }
                this.goToRawIndex(currentRawPixelIndex);
            }
        }
    },
    compareMapChanges: function(prevImageData, returnMarkedImageData=false) {
        this.reset();
        prevImageData.reset();
        let thisPixel, prevPixel;
        let pixelDiff;
        const rgbDiffs = []
        // An array of 0s and 1s, in order of pixel indexes, where:
        // 0: no action (pixel color stays "same")
        // 1: action (pixel color is "changed")
        let indexChanges = [];
        // This will contain the image data, and red pixels where there are pixel changes.
        let markedImageDataRaw = [];

        let hasPixelChange = false;
        while (thisPixel = this.next().value) {
            prevPixel = prevImageData.next().value;
            // Delta values of each channel, comparing the two images
            pixelDiff = [
                Math.floor((thisPixel[0] - prevPixel[0]) / QS),
                Math.floor((thisPixel[1] - prevPixel[1]) / QS),
                Math.floor((thisPixel[2] - prevPixel[2]) / QS)
            ];
            hasPixelChange = pixelDiff.some(delta=> delta !== 0);
            if (returnMarkedImageData) {
                if (hasPixelChange) {
                    if (changeVisualizationMode === "transition") {
                        const changeAmount =  pixelDiff.sumAbs();
                        const changeRateColor = YELLOW.map((c,i)=> Math.round(c + ((RED[i]-c) / 4) * changeAmount));
                        markedImageDataRaw.push(...[...changeRateColor, 255]);
                    }
                    else if (changeVisualizationMode === "single") {
                        markedImageDataRaw.push(...[...RED, 255]);
                    }
                }
                else {
                    markedImageDataRaw.push(...thisPixel);
                }
            }
            else {
                if (hasPixelChange) {
                    indexChanges.push(1);
                    rgbDiffs.push(pixelDiff);
                }
                else {
                    // We need the diffs array to be the same size as frame_size, for later (noise cancelation)
                    rgbDiffs.push(null);
                    indexChanges.push(0)
                }
            }
        }
        this.reset();
        prevImageData.reset();
        return returnMarkedImageData ? markedImageDataRaw : [indexChanges, rgbDiffs];
    },
    changesDiff: function (imageDataWithChangesRaw) {
        const imageData = ImageData.fromRawData(imageDataWithChangesRaw, FRAME_WIDTH, FRAME_HEIGHT); 
        imageData.reset();
        const newImageDataRaw = [];
        let pixel, isRed;
        while (pixel = imageData.next().value) {
            isRed = pixel[0] === 255 && pixel[1] === 0 && pixel[2] === 0;
            if (isRed)
                newImageDataRaw.push(...[255, 255, 255, 255]);
            else
                newImageDataRaw.push(...[0, 0, 0, 255]);
        }
        this.reset();
        return newImageDataRaw;
    },
    applyChanges: function(pixelActions, pixelDiffs) {
        if (!pixelDiffs.length) return;
        this.reset();
        let pixel, thisPixelIndex;
        while (pixel = this.next().value) {
            thisPixelIndex = this.currentPixelIndex - 1;
            if (pixelActions[thisPixelIndex] === 1) {
                const [rd, gd, bd] = pixelDiffs[thisPixelIndex];

                const ri = qiclamp(Q_COLORS_SWAPPED[pixel[0]] + rd);
                const gi = qiclamp(Q_COLORS_SWAPPED[pixel[1]] + gd);
                const bi = qiclamp(Q_COLORS_SWAPPED[pixel[2]] + bd);

                const newPixel = [
                    Q_COLORS[ri], 
                    Q_COLORS[gi], 
                    Q_COLORS[bi], 
                    255
                ];
                this.data.set(newPixel, this.currentRawPixelIndex - 4);
            }
        }
        this.reset();
    },
    toGrayScale: function() {
        let pixel, gray;
        while (pixel = this.next().value) {
            gray = RW * pixel[0] + GW * pixel[1] + BW * pixel[2];
            this.data.set([gray, gray, gray, 255], this.currentRawPixelIndex-4);
        }
    },
    clone: function() {
        return new ImageData(new Uint8ClampedArray(this.data), FRAME_WIDTH);
    },
    numOfUniqueColors: function() {
        const colors = new Set();
        let pixel;
        while (pixel = this.next().value) {
            colors.add(pixel.toString());
        }
        return colors.size;
    },
    dct: function() {
        return Array.from(this.data).dct();
    }
}