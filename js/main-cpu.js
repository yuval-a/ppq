
import config from '../modules/config.mjs';
const { FRAME_WIDTH, FRAME_HEIGHT, FRAME_SIZE, MIN_Q, MAX_Q } = config;
import extend from '../modules/extend.mjs';
import { setQColors, generateOutputImageDataRawFromData } from '../modules/ppq-utils.mjs';

var currentIFrameImageData;
// When this is true - the next frame should be an "IFrame" (a "full" representation of a frame).
// This should be initiated also whenever the Q and Q_COLORS are changed.
// On network streaming - every IFrame should be transferred.
var newIFrame = false;

// Object to contain references to DOM elements
const DOM = {
    webcamVideo: null,
    webcamVideoLabel: null,
    normalizedVideoCanvasLabel: null,
    quantizedVideoCanvasLabel: null,
    changesCanvasLabel: null,
    outputVideoCanvasLabel: null,
    fullOutputModeCheckbox: null,
    debugInfo: null
}

// Canvas contexts
const CONTEXT = {
    offscreen: null,
    normalized: null,
    quantized: null,
    quantizedDithered: null,
    changes: null,
    changesDiff: null,
    output: null,
    fullOutput: null
}

const EVENTS = {
    newIFrame: function(rawImageData) {
        newIFrame = false;
        //const numOfBits = numOfBitsByMaxValue(Q_COLORS.length-1);
        //const encodedIFrame = encodeIFrame(rawImageData, numOfBits);
        //const decodedIFrame = decodeIFrame(encodedIFrame, numOfBits);
        currentIFrameImageData = ImageData.fromRawData(rawImageData, FRAME_WIDTH, FRAME_HEIGHT);
        CONTEXT.output.putImageData(currentIFrameImageData, 0, 0);
        currentOutputFrame = currentIFrameImageData;
    }
}
function logDebugInfo(text) {
    if (!DOM.debugInfo) return;
    DOM.debugInfo.innerHTML = text;
}

function initDOM() {
    DOM.webcamVideo = document.getElementById('webcamVideo');
    DOM.webcamVideoLabel = document.querySelector('label[for="webcamVideo"]');
    DOM.normalizedVideoCanvasLabel = document.querySelector('label[for="normalizedVideoCanvas"]');
    DOM.quantizedVideoCanvasLabel = document.querySelector('label[for="quantizedVideoCanvas"]');
    DOM.changesCanvasLabel = document.querySelector('label[for="changesCanvas"]');
    DOM.outputVideoCanvasLabel = document.querySelector('label[for="outputVideoCanvas"]');
    DOM.fullOutputModeCheckbox = document.getElementById('fullOutputModeCheckbox')
    DOM.debugInfo   = document.getElementById('debugInfo');
}

function initCanvasContexts() {
    const offscreenCanvas = new OffscreenCanvas(FRAME_WIDTH, FRAME_HEIGHT);
    CONTEXT.offscreen = offscreenCanvas.getContext('2d', { willReadFrequently: true });
    CONTEXT.normalized = document.getElementById('normalizedVideoCanvas').getContext('2d');
    CONTEXT.quantized = document.getElementById('quantizedVideoCanvas').getContext('2d');
    CONTEXT.changes = document.getElementById('changesCanvas').getContext('2d');
    CONTEXT.changesDiff = document.getElementById('changesDiffCanvas').getContext('2d');
    CONTEXT.output = document.getElementById('outputVideoCanvas').getContext('2d');
}

var originalFrameImageData;
var frameImageData;
var frameImageDataNormalized;
var frameImageDataQuantized;
var prevFrameImageData;
var prevFrameImageDataQuantized;
var currentOutputFrame;
var Q, QS;
var pixelChangeCountInFrame = 0;
var pixelChangeCountSum = 0;
var avgPixelChangeCount = 0;
var frames = 0;
var actionIndexes, pixelDiffs, roundingDiffs;
var debugLog;
var doLog = false;

// Set to true to generate the output including the rounding diffs data.
var outputWithRoundings = false;
function frameLoop() {
    
    frames++;
    CONTEXT.offscreen.drawImage(DOM.webcamVideo, 0, 0, FRAME_WIDTH, FRAME_HEIGHT);
    frameImageData = CONTEXT.offscreen.getImageData(0, 0, FRAME_WIDTH, FRAME_HEIGHT);
    DOM.webcamVideoLabel.textContent = "Webcam video input, number of unique colors: " + frameImageData.numOfUniqueColors();

    // Note, we're doing it on the main thread so we can show the intermediate results on canvases - in network scenario - we might prefer to pass to
    // worker thread

    // First frame/ IFrame scenario
    if (!prevFrameImageData) {
        prevFrameImageData = frameImageData.clone();
        prevFrameImageDataQuantized = frameImageData.clone();
        requestAnimationFrame(()=> frameLoop());
        return;
    }

    originalFrameImageData = frameImageData.clone();
    frameImageData.smoothComparedTo(prevFrameImageData);
    frameImageDataNormalized = frameImageData.clone();
    prevFrameImageData = frameImageDataNormalized;
    CONTEXT.normalized.putImageData(frameImageDataNormalized, 0, 0);
    DOM.normalizedVideoCanvasLabel.textContent = "Normalized image data, number of unique colors: " + frameImageDataNormalized.numOfUniqueColors();

    frameImageDataQuantized = frameImageDataNormalized.clone();
    roundingDiffs = frameImageDataQuantized.quantize();
    CONTEXT.quantized.putImageData(frameImageDataQuantized, 0, 0);
    DOM.quantizedVideoCanvasLabel.textContent = "Quantized image data, number of unique colors: " + frameImageDataQuantized.numOfUniqueColors();

    if (newIFrame) {
        EVENTS.newIFrame(frameImageDataQuantized.data);
    }
    const imageDataWithChangesRaw = frameImageDataQuantized.compareMapChanges(prevFrameImageDataQuantized, true, actionIndexes);
    const imageDataWithChanges = ImageData.fromRawData(imageDataWithChangesRaw, FRAME_WIDTH, FRAME_HEIGHT);

    [actionIndexes, pixelDiffs] = frameImageDataQuantized.compareMapChanges(prevFrameImageDataQuantized, false);
    prevFrameImageDataQuantized = frameImageDataQuantized;
    
    if (pixelDiffs.filter(d=> d !== null).length > FRAME_SIZE * 0.40) {
        EVENTS.newIFrame(frameImageDataQuantized.data);
        requestAnimationFrame(()=> frameLoop());
        return;
    }
    DOM.changesCanvasLabel.textContent = "Number of changed pixels: " + actionIndexes.filter(a=> a===1).length;
    CONTEXT.changes.putImageData(imageDataWithChanges, 0, 0);
    CONTEXT.changesDiff.putImageData(ImageData.fromRawData(frameImageData.changesDiff(imageDataWithChanges.data), FRAME_WIDTH, FRAME_HEIGHT), 0, 0);

    if (pixelDiffs && pixelDiffs.length && currentOutputFrame) {
        if (doLog) {
            console.log (pixelDiffs.flat());
            doLog = false;
        }
        pixelChangeCountInFrame = actionIndexes.filter(a=> a === 1).length;
        pixelChangeCountSum += pixelChangeCountInFrame;
        avgPixelChangeCount = Math.floor(pixelChangeCountSum / frames);

        if (!outputWithRoundings) {
            currentOutputFrame.applyChanges(actionIndexes, pixelDiffs);
            CONTEXT.output.putImageData(currentOutputFrame, 0, 0);
            DOM.outputVideoCanvasLabel.textContent = "Output image data - quantized, number of unique colors: " + currentOutputFrame.numOfUniqueColors();
        }
        else {
            const fullOutputImageRawData = generateOutputImageDataRawFromData(prevFrameImageDataQuantized, actionIndexes, pixelDiffs, roundingDiffs);
            if (fullOutputImageRawData.length) {
                const fullOutputImageData = ImageData.fromRawData(fullOutputImageRawData, FRAME_WIDTH, FRAME_HEIGHT);
                CONTEXT.output.putImageData(fullOutputImageData, 0, 0);
                DOM.outputVideoCanvasLabel.textContent = "Output image data - dequantized, number of unique colors: " + fullOutputImageData.numOfUniqueColors();
            }

            // Or use a worker thread instead (usually slower because of the transfer overhead)
            // decoderWorker.postMessage([currentOutputFrame, actionIndexes, pixelDiffs, rounds]);
        }

    }

    debugLog = `Pixels changed this frame: ${pixelChangeCountInFrame} ${Math.floor(pixelChangeCountInFrame / FRAME_SIZE * 100)}% <br>
                 Average pixels changed count: ${avgPixelChangeCount}, ${Math.floor(avgPixelChangeCount / FRAME_SIZE * 100)}% <br>`;

    logDebugInfo(debugLog);
    requestAnimationFrame(()=> frameLoop());
}

function initWebcam() {
    // Get access to the user's webcam
    navigator.mediaDevices.getUserMedia({
        // video: true
        video: { width: FRAME_WIDTH, height: FRAME_HEIGHT, frameRate: 60 },
        audio: false
    })
    .then(function (stream) {
        // Set the video source to the user's webcam stream
        DOM.webcamVideo.srcObject = stream;
            
        // Log data about video and webcam
        const videoTrack = stream.getVideoTracks()[0];
        console.log (videoTrack.getSettings());
        console.log (videoTrack.getCapabilities());
        console.log (videoTrack.getConstraints());
    })
    .catch(function (error) {
        console.error('Error accessing webcam:', error);
    });

    DOM.webcamVideo.addEventListener('loadeddata', ()=> {
        setTimeout(frameLoop, 1000);
    });

}

var decoderWorker;

function run() {
    extend();
    initDOM();
    initCanvasContexts();
    [Q, QS] = setQColors();
    newIFrame = true;
    logDebugInfo(`Q: ${Q}, QS: ${QS}`);

    // An experimental worker thread to generate output image with diff roundings
    /*
    decoderWorker = new Worker("js/worker-cpu.js", { type: "module" });
    decoderWorker.onmessage = function(evt) {
        const fullOutputImageDataRaw = evt.data;
        const fullOutputImageDataRaw = generateOutputImageDataRawFromData(prevFrameImageDataQuantized, actionIndexes, pixelDiffs, roundingDiffs);
        if (fullOutputImageRawData.length) {
            const fullOutputImageData = ImageData.fromRawData(fullOutputImageRawData, FRAME_WIDTH, FRAME_HEIGHT);
            CONTEXT.output.putImageData(fullOutputImageData, 0, 0);
            DOM.outputVideoCanvasLabel.textContent = "Output image data - dequantized, number of unique colors: " + fullOutputImageData.numOfUniqueColors();
        }
    }
    */
    initWebcam();

    document.addEventListener('keyup', (({key})=> {
        switch (key) {
            case 'a':
                if (Q < MAX_Q) {
                    [Q, QS] = setQColors(++Q);
                    newIFrame = true;
                    logDebugInfo(`Q: ${Q}, QS: ${QS}`);
                }
                break;
            case 'z':
                if (Q > MIN_Q) {
                    [Q, QS] = setQColors(--Q);
                    newIFrame = true;
                    logDebugInfo(`Q: ${Q}, QS: ${QS}`);
                }
                break;
            
            case ' ':
                doLog = true;
                break;
        }
    }));

    DOM.fullOutputModeCheckbox.addEventListener('change', function() {
        newIFrame = true;
        outputWithRoundings = this.checked;
    });

}

document.addEventListener("DOMContentLoaded", run);
