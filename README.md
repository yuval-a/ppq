# Per Pixel Color Channel Quantization experiment

## Introduction
This is an experiement, implementing and testing the concept of "Inter frame streaming", by detecting the color changes between video frames on a "per pixel" level.
The implementation is a demonstration done in native Javascript client code. To see the examples - simply run a static http server (I like to use the [Reload](https://www.npmjs.com/package/reload) NPM package which also offers hot reloading), and browse to `stream-cpu.html` HTML file.

## Stages
On each video frame, we start from a raw RGB(A) data acquired from the webcam video input (using an offscreen `Canvas`' `getImageData` method), and we run a series of transformations on it - 
the result after each transformation is shown, for clarity.
The image data is a flat array of bytes, every 4 bytes represents a full pixel information in RGB color space, and another Alpha value (which we mostly ignore - and always assume to be 255 for this context). So an example pixel value could be: 120, 40, 30, 255.
Most of the implementation is done in methods extending the prototype of the native JS `ImageData` object, for making things easier and readable, code-wise.

### Normalization
For the algorithm to work correctly, we need to be able to differentiate between the "static" parts (pixels) of the frames, and the "changed" parts.
When directly comparing each frame to the previous one in the webcam input, by comparing the values of pixels on same indexes - we discover that even for pixels which are "static" - 
there are differences in RGB values on each frame iteration. This is, to a lesser extent because even "static" parts of the outside world have "subtle" movements, but to a higher extent - 
it is most likely the result of the browser's decoder. The webcam likely has an internal video encoder which is most likely a variation o H264 or its successors - 
the deviations of RGB values between consequtive frames - even for "static" pixels, is the effect of H264 using quantization and rounding methods itself, yielding on each frame - RGB colors which are "close" or "similar" but still different.
So the first step performs a "normalization" - where for each pixel - if the "distance" between it and the previous pixel (the pixel from the previous frame) on the same index are below a certain threshold - they are "close", and the "new" pixel is "discarded" - using the value of the pixel from the previous frame instead for this frame instead (thereby, considering as a "no-change" pixel). This may result in visible artifacts and 'noise' in the normalized frame - which is different according to the "distance measuring method" we use, and the threshold values we use.

There are 3 different distance methods to choose from right now, 2 are RGB based, and one is Luma based.

#### About "Luma" and Luminance
Luminance is "the objective brightness" of a color, as perceived by the human eye, taking into account the different sensitivies for red, blue and green wavelengths. Human eyes are more sensitive to changes and hues in green (the assumption is that it is a remainder from ancient times where it was important to observe and identify a dangerous prey lurking between green trees and plants in the jungle).
Luma is the "digital" representation of Luminance, caluclated from RGB values, it is calculated by multiplying each RGB value by a weight and summing up the result. The weight values are based on scientific research, and can be different according to different "standards" (e.g. BT.601, BT.709, BT.2020), but they all reflect the relations between the different sensitivity to red, green and blue (with green having the highest sensitivity) in the human eye.

#### RGB
* Simple method: A "base" threshold value is used, and is then reduced for each RGB channel by a weight (taken from the weights from the Luma calculation), giving a threshold value for each channel. If one of the channels is higher than its threshold, then the color is considered "too far". This method gives good results and is also the most performant one, as the condition is checked with an AND (&&) (always starting with the Green channel) - so if one of the channels is too far - it already breaks the check.
* Advanced method: In this method a different threshold is set for the "major" channel (the one having the maximum value), and a different one (usually higher) for the other two. This is based on the fact that the major channel value has the most effect on the "percievement" of the color, and the other two values then mostly contribute to other factors of the color, such as lightness, tone, saturation and so on.
#### Luma
* In this method, the luma value is calculated for both compared pixels - and the difference between the lumas is compared against a threshold - this is similar in a way to the first RGB method, but it ALWAYS takes into account ALL RGB channels, which gives slightly different results.

### Quantization
Quantization is the process of getting a "similar" result, using "less data points" - in our context it is an attempt to use less colors for an image, while still preserving the clarity and percievemnt of the image, the way it looks. Quantization is usually done by dividing all data points in a certain value and rounding the results - it is also used in H264 to round coefficents after DCT transformation (that shows values of the image in the frequency domain).

We use a uniform "clustering method", where we devide the total number of colors (256, in 8-bit colors) by a value which we call `Q` which represents the number of clusters - which will in effect be the number of "colors" (actually the number of possible values for each RGB channel), the result is the "step size" (which we call `QS`) - the gap between values, that actual values will be rounded to.
For example, if our Q is 32, then we will have 32 "clusters", each having a value in steps of 8 (QS), which will look like this:
 `[8, 16, 24, 32, 40, 48, 56, 64, 72, 80, 88, 96, 104, 112, 120, 128, 136, 144, 152, 160, 168, 176, 184, 192, 200, 208, 216, 224, 232, 240, 248]`

When performing quantization, the value of each RGB channel is rounded to the closest value in the array. The quantization array is sort of a "map" for the rounding.
So, if the value is e.g. 59 - it will be rounded down to 56 (the closest value in the array), and if it is 61 it will be rounded up to 64.
We also clamp values between the range of the first and last value - n the example above, this also means that the "darkest" color/hue becomes 8 instead of 0, and 248 instead of 255.

The clustering method is known and popularly used in different contexts, including in ML. There is a known algorithm for determining "optimal" values for the clusters (called "centeroids") which is known as "K Means Clustering" or "K Means Weighting" - where K here represents the number of desired clusters (same as our Q) - the algorithm starts with random "centeroids" (value for each cluster) - then starts assigning values to each cluster, by the distances to the centeroids, then an average (mean value) for all values in each cluster is calculated, and this value becomes the new centeroid for the cluster, and this method is then repeated a few times.
I've tried implementing it - but eventually the results usually become very similar to the simple uniform spread of colors values in the spectrum - so I decided to stick with the more basic uniform method.
I also use the same clusters for all RGB values, it's possibe to experiement with a sepearte cluster array for each channel (e.g. green could haver a higher resolution one as human sight is more sensitive to it, etc.).
I call this array/table/map - Q_COLORS.

In this stage we, optionally save the rounding differences for each pixel for later use.

### Comparing and mapping differences
We compare a quantized frame pixels, to the previous quantized frame, this yields results where only more "dominant" or "clearly visible" color changes between pixels can be detect - 
the sensitivity is affected by both the method and the values we use in the normalization step, and the values we use for quantizations: higher values preserve better image quality - but the color change detection becomes more sensitive, and can detect more "static" pixels as "changed", while lower values make the image less clear, more pixelated - possibly showing artifacts and color bleed - but the color change detection becomes "better" - and is able to detect more meaningful and "actual" color changes.

For each pixel, if we detect a color change in it (in one or more of the RGB channels) we save the differences - the number of "jumps" between clusters - this can be negative or positive. 
For relativly small movements of "objects" or "blocks of similar color" (e.g. a human face) within a frame - these are usually very small values between -2 and +2, and are higher for the areas where the "edges" of the area "moves into a new pixel". Those values are good for compression, using adaptive variable bit length techniques (this part is still not implemented in this code drop-off version).
We call this array the "Pixel diffs" array.

We also save an "action array" - a series of 0s and 1s, each representing a pixel in the frame (so the length is the frame-size, e.g. for 320x240: 76800) <br>
1: representing a changed color pixel (action) <br>
0: representing a pixel without changed color (no action) <br>
This can be encoded in single bits, and later be efficentlely compressed using RLE compression (where we only save the numbers of consequtive 0s and consequtive 1s) - yeilding a small array.
We can also use the data for finding "blocks" of changes, or trying to isolate "noise".

### Outputing the result using our data
On the first frame-loop iteration we save a "reference frame" data (H264 calls this an "I-Frame") - we can also decide to peridocally save a new one (this is a setting in H264 as well).
To generate an output frame, we iterate over the "action pixels" (using the action array) - and we change just their colors using the data from the pixel diffs.

#### Dequantization: adding the rounding diffs
This method is enough to generate an output frame, but it will still be "quantized" - it will have few colors - similar to the number of clusters in our quantization step - resulting in a "dull" color appearance.

To add more color richness or sharpness - we can use the "rounding diffs" array we optionally save in the rounding phase (but then - this is another data we need to send, if implementing this for streaming) - the rounding diffs are also small numbers (if QS is 8, they are between -4 and 4 - which means it's possible to represent them using 3 bits) - which can be encoded and compressed.
If we use the rounding diffs, then we use the values to add them to the values of the quantized colors, theortically restoring some of the original "richness" of the image.

## Files
`stream-cpu.html`: browse to this to run the demonstration.
`config.mjs`: Configuration module - all of the "numbers" and values, and settings that can affect the algorithm should all be concentrated in this file.
`extend.mjs`: JS prototype extensions for extending native APIs for our cause.
`ImageData-extend-prototype.mjs`: most of the actual logic implementations are in the file - which extends the native `ImageData` object with relevant methods that can easily work on the actual raw pixel data of the ImageData, and also adds iteration options for easily iterating on the image pixels.
`main-cpu.js`: The main Javascript file that the HTML uses - this runs all the steps and transformation in a "frame loop" mechanism.
`color-utils.mjs`: Additional utils related to color calculations.
`ppq-utils.mjs`: Methods relating to the algorithm.

`rgb.html`: A side tool simple RGB picker
`stream-h264.html`: A simple H264 Encoder (using MediaRecorder) that allows encoding to H264 and saving to a file, for quick comparison.
