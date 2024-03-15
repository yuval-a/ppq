import ExtendedImageDataPrototype from './ImageData-extend-prototype.mjs';

// Various prototype extensions for JS API, to make things easier
export default function() {

    Array.prototype.sum = function() {
        return this.reduce((sum, val)=> sum + val, 0);
    }
    Array.prototype.sumAbs = function() {
        return this.reduce((sum, val)=> sum + Math.abs(val), 0);
    }

    Array.prototype.avg = function() {
        return this.sum() / this.length;
    }
    Array.prototype.avgAbs = function() {
        return this.sumAbs() / this.length;
    }
    
    // Add more functionality to ImageData, like pixel iteration, and algorithm related functions.
    Object.assign(ImageData.prototype, ExtendedImageDataPrototype);
    ImageData.fromRawData = function(rawImageData, width, height, colorSpace = "srgb" ) {
        return new ImageData(new Uint8ClampedArray(rawImageData), width, height, { colorSpace });
    }

    Array.prototype.dct = function() {
        const input = this;
        const len = input.length;
        const output = new Array(len).fill(0);
        
        for (let k = 0; k < len; k++) {
            let sum = 0;
            for (let n = 0; n < len; n++) {
                sum += input[n] * Math.cos((Math.PI / len) * (n + 0.5) * k);
            }
            sum *= Math.sqrt(2 / len);
            if (k === 0) sum /= Math.sqrt(2);
            output[k] = sum;
        }
        
        return output;
    }
}