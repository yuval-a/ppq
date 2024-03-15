// An experimental worker thread to decode final output frame in a separate thread.

import extend from '../modules/extend.mjs';
import { generateOutputImageDataRawFromData, setQColors } from "../modules/ppq-utils.mjs";

extend();
const [Q, QS] = setQColors();

onmessage = function(evt) {
    const outputImageRawData =  generateOutputImageDataRawFromData(evt.data[0], evt.data[1], evt.data[2], evt.data[3]);
    postMessage(outputImageRawData);
}