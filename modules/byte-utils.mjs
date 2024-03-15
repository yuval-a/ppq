
// Return a series of numOfBits-bit numbers as an array of bytes
export function packToByteArray(numbers, numOfBits) {
    // Calculate the needed buffer size: ceil of (numbers.length * numOfBits) / 8 bytes
    const bufferSize = Math.ceil((numbers.length * numOfBits) / 8);
    const buffer = new Uint8Array(bufferSize);
    const maxValue = maxValueByNumOfBits(numOfBits);
    const overflowBits = 8 - numOfBits;
    let bitOffset = 0; // Tracks the current bit position in the buffer.

    numbers.forEach(number=> {
        if (number < 0 || number > maxValue) {
            throw new Error("Each number must be a 5-bit unsigned integer (0-31).");
        }

        const byteOffset = Math.floor(bitOffset / 8);
        const intraByteOffset = bitOffset % 8;

        // Fit the number into the current and possibly the next byte.
        buffer[byteOffset] |= number << intraByteOffset;
        if (intraByteOffset > overflowBits) { // If it overflows to the next byte
            buffer[byteOffset + 1] = number >> (8 - intraByteOffset);
        }

        bitOffset += numOfBits; // Move the bit offset for the next number
    });

    return buffer;
}

// Convert a byte array to a series of numOfBits-bit numbers
export function unpackFromByteArray(byteArray, numOfBits) {
    const buffer = byteArray;
    const maxValue = maxValueByNumOfBits(numOfBits);

    const numbers = [];
    let bitOffset = 0; // Tracks the current bit position in the buffer.

    while (bitOffset < buffer.length * 8) {
        if (buffer.length*8 - bitOffset < numOfBits) break;
        const byteOffset = Math.floor(bitOffset / 8);
        const intraByteOffset = bitOffset % 8;
        // Construct the number from the current and possibly the next byte.
        let number = (buffer[byteOffset] >> intraByteOffset) & maxValue; // Extracts the first part.
        if (intraByteOffset > 3) { // If it extends into the next byte
            const nextBits = (buffer[byteOffset + 1] & (255 >> (8 - intraByteOffset))) << (8 - intraByteOffset);
            number |= nextBits;
        }

        numbers.push(number & maxValue); // Ensure the number is a 5-bit value.
        bitOffset += numOfBits; // Move the bit offset for the next number.
    }

    return numbers;
}

/* String based functions - less performant */
/*
export function packToByteArray(numbers, numOfBits) {

    const result = [];
    let binaryStr = numbers.map(number=> number.toString(2).padStart(numOfBits, '0')).join('');
    //binaryStr = binaryStr.padEnd((8 - binaryStr.length % 8) % 8, '0');
    let binaryNumberStr;
    let nextIndex = 0;
    while (binaryNumberStr = binaryStr.slice(nextIndex, nextIndex+8)) {
        binaryNumberStr = "0b" + binaryNumberStr.padEnd(8, '0');
        result.push(Number(binaryNumberStr));
        nextIndex += 8;
    }
    return result;
}

export function unpackFromByteArray(byteArray, numOfBits) {

    const result = [];
    const binaryStr = byteArray.map(byte=> byte.toString(2).padStart(8, '0')).join('');

    let binaryNumberStr;
    let nextIndex = 0;
    while (binaryNumberStr = binaryStr.slice(nextIndex, nextIndex+numOfBits)) {
        if (binaryNumberStr.length !== numOfBits) break;
        binaryNumberStr = "0b" + binaryNumberStr;
        result.push(Number(binaryNumberStr));
        nextIndex += numOfBits;
    }
    console.log (nextIndex);


    return result;
}
*/

function maxValueByNumOfBits(numOfBits) {
    return Math.pow(2, numOfBits) - 1;
}
export function numOfBitsByMaxValue(maxValue) {
   return Math.ceil(Math.log2(maxValue));
}

