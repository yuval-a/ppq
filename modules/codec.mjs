import { getQChannelColorIndex, getQColorByIndex } from "./ppq-utils.mjs";
import { packToByteArray, unpackFromByteArray  } from "./byte-utils.mjs";

// Must be a quantized ImageData
export function encodeIFrame(frameImageData, numOfBits) {
    const encodedFrame = [];
    let pixel;
    while (pixel = frameImageData.next().value) {
        encodedFrame.push(
            getQChannelColorIndex(pixel[0]),
            getQChannelColorIndex(pixel[1]),
            getQChannelColorIndex(pixel[2])
        );
    }
    return packToByteArray(encodedFrame, numOfBits);
}

export function decodeIFrame(encodedFrame,  numOfBits) {
    const encodedData = unpackFromByteArray(encodedFrame, numOfBits);
    const imageData = [];
    for (let i=0; i<encodedData.length; i+=3) {
        imageData.push(
            getQColorByIndex(encodedData[i]),
            getQColorByIndex(encodedData[i+1]),
            getQColorByIndex(encodedData[i+2]),
            255
        );
    }
    return imageData;
}

/*
export function encodeFrame(actionIndexes, pixelDiffs) {
    const diffs = pixelDiffs.flat().filter(d=> d!==0);
    console.log (diffs.filter(d=> Math.abs(d) === 4));
    //const encoded = [ [...actionIndexes], [...zorleCompress(actionIndexes)], [...pixelDiffs] ];

    /*
    const hdiffs = pixelDiffs.flat().filter(d=> d>4);
    if (hdiffs.length) console.log (hdiffs);
    //console.log (encoded);
    return encoded;
    */
//}

export function zorleCompress(byteArray) {
    const compressed = [];
    let ZeroFlag = false;
    let counter = 0;
    for (let byte of byteArray) {
        if (byte === 0) {
            if (!ZeroFlag) {
                if (counter) compressed.push(counter);
                ZeroFlag = true;
                counter = 1;
            }
            else {
                counter++;
            }
        }
        else {
            if (ZeroFlag) {
                if (counter) compressed.push(counter);
                ZeroFlag = false;
                counter = 1;
            }
            else {
                counter++;
            }
        }
    }
    if (counter) compressed.push(counter);
    return compressed;
}