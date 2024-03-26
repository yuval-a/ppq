export default {
    FRAME_WIDTH: 320,
    FRAME_HEIGHT: 240,
    // display-p3, or srgb
    COLORSPACE: "srgb",
    SHARPEN_MATRIX: [ 0, -1,  0, -1,  5, -1,  0, -1,  0 ],
    get FRAME_SIZE() { return this.FRAME_WIDTH * this.FRAME_HEIGHT },
    RGB_WEIGHTS: {
        NO: {
            R: 0,
            G: 0,
            B: 0
        },
        ME: {
            R: 0.3408,
            G: 0.5152,
            B: 0.114
        },
        // BT.601
        SD: {
            R: 0.299,
            G: 0.587,
            B: 0.114
        },
        // BT.709
        HD: {
            R: 0.2126,
            G: 0.7152,
            B: 0.0722
        },
        // BT.2020
        UHD: {
            R: 0.2627,
            G: 0.6780,
            B: 0.0593
        }
    },
    MIN_Q: 2, 
    MAX_Q: 128,
    START_Q: 32,
    // If the difference between the RGB averages (or euclidan distances if used instead) of neighbouring pixels is less than this value, 
    // it means there's a "smooth gradient" between them,
    // We use it to implement some adaptibility in the color distance function used for normalization
    MAX_RGB_DIFF_FOR_SMOOTH_GRADIENT: 4,
    MAX_LUMA_DIFF_FOR_SMOOTH_GRADIENT: 4,
    // Can be either "single" or "transition":
    // "single": show changed pixels as red pixels
    // "transition": show changed pixels in a color range between yellow and red reflecting the intensity of the change (higher values are more red).
    DIFF_VISUAL_MODE: "single",
    // For basic uniform RGB distance
    RGB_DISTANCE_BASE_THRESHOLD: 32,
    // For seperate distance for major RGB channels and the other two channels
    RGB_DISTANCE_MAJOR_THRESHOLD: 24,
    RGB_DISTANCE_MINOR_THRESHOLD: 24,
    USE_ADVANCED_DISTANCE_RGB: false,
    RGB_WEIGHT_STANDARD: "UHD",
    LUMA_THRESHOLD: 12,
    // Can be either luma or RGB
    COLOR_DISTANCE_METHOD: "RGB",
    // If true, the threshold for color distance functions in normalization step will be reduced by half for parts with smooth gardients - 
    // this will make the image look sharper, but will result with a higher number of pixel-color detected as changes
    NORMALIZE_ADAPT: false
}