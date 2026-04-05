const chroma = require('chroma-js');
const _ = require('lodash');

/**
 * Calculate relative luminance (WCAG)
 */
const luminance = (color) => {
    const [r, g, b] = chroma(color).rgb().map((v) => {
        v /= 255;
        return v <= 0.03928
            ? v / 12.92
            : Math.pow((v + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/**
 * Decide best contrast color (black / white)
 */
const getContrastColor = (bgColor) => {
    return luminance(bgColor) > 0.5 ? '#000000' : '#ffffff';
};

/**
 * Generates palettes from the provided configuration.
 */
const generatePalette = (config) => {
    const palette = {
        50: null,
        100: null,
        200: null,
        300: null,
        400: null,
        500: null,
        600: null,
        700: null,
        800: null,
        900: null,
    };

    if (_.isString(config)) {
        palette[500] = chroma.valid(config) ? config : null;
    }

    if (_.isPlainObject(config)) {
        if (!chroma.valid(config[500])) {
            throw new Error(
                'Palette must contain a valid 500 color.'
            );
        }

        config = _.pick(config, Object.keys(palette));

        _.mergeWith(palette, config, (_, srcValue) =>
            chroma.valid(srcValue) ? srcValue : null
        );
    }

    const colors = Object.values(palette).filter(Boolean);

    colors.unshift(
        chroma
            .scale(['white', palette[500]])
            .mode('lrgb')
            .colors(50)[1]
    );

    colors.push(
        chroma
            .scale(['black', palette[500]])
            .mode('lrgb')
            .colors(10)[1]
    );

    const domain = [
        0,
        ...Object.entries(palette)
            .filter(([, value]) => value)
            .map(([key]) => parseInt(key) / 1000),
        1,
    ];

    const scale = chroma.scale(colors).domain(domain).mode('lrgb');

    const finalPalette = {
        50: scale(0.05).hex(),
        100: scale(0.1).hex(),
        200: scale(0.2).hex(),
        300: scale(0.3).hex(),
        400: scale(0.4).hex(),
        500: scale(0.5).hex(),
        600: scale(0.6).hex(),
        700: scale(0.7).hex(),
        800: scale(0.8).hex(),
        900: scale(0.9).hex(),
    };

    // 👇 THIS IS WHAT YOU WERE MISSING
    const DEFAULT_SHADE = finalPalette[600];
    const contrast = getContrastColor(DEFAULT_SHADE);

    return {
        ...finalPalette,
        DEFAULT: DEFAULT_SHADE,
        contrast,
    };
};

module.exports = generatePalette;
