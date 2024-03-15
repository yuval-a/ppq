export default {
    FRAME_WIDTH: 320,
    FRAME_HEIGHT: 240,
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
    COLOR_DISTANCE_METHOD: "luma",
}