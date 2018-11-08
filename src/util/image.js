// @flow

import assert from 'assert';

import { register } from './web_worker_transfer';

export type Size = {
    width: number,
    height: number
};

type Point = {
    x: number,
    y: number
};

function createImage(image: *, {width, height}: Size, channels: number, data?: Uint8Array | Uint8ClampedArray) {
    if (!data) {
        data = new Uint8Array(width * height * channels);
    } else if (data.length !== width * height * channels) {
        // FIXME: Some font glyph data we're seeing back from ArcGIS tiles are
        // returning mismatched image sizes. Since these glyphs don't seem
        // absolutely necessary to render most of the rest of the map, go ahead
        // and continue with empty image data in these cases so the rest of the
        // map can load. But we need to better figure this out and see where
        // the error really occurs and how to better address this.
        //
        // For reference, this is reproducible when zooming into the zip code
        // "21203," which tries loading
        // "https://basemaps.arcgis.com/arcgis/rest/services/World_Basemap_v2/VectorTileServer/resources/fonts/Arial%20Regular/8192-8447.pbf"
        // which is where this error seems to stem from.
        //
        // throw new RangeError('mismatched image size');
        console.error('mismatched image size');
        data = new Uint8Array(width * height * channels);
    }
    image.width = width;
    image.height = height;
    image.data = data;
    return image;
}

function resizeImage(image: *, {width, height}: Size, channels: number) {
    if (width === image.width && height === image.height) {
        return;
    }

    const newImage = createImage({}, {width, height}, channels);

    copyImage(image, newImage, {x: 0, y: 0}, {x: 0, y: 0}, {
        width: Math.min(image.width, width),
        height: Math.min(image.height, height)
    }, channels);

    image.width = width;
    image.height = height;
    image.data = newImage.data;
}

function copyImage(srcImg: *, dstImg: *, srcPt: Point, dstPt: Point, size: Size, channels: number) {
    if (size.width === 0 || size.height === 0) {
        return dstImg;
    }

    if (size.width > srcImg.width ||
        size.height > srcImg.height ||
        srcPt.x > srcImg.width - size.width ||
        srcPt.y > srcImg.height - size.height) {
        throw new RangeError('out of range source coordinates for image copy');
    }

    if (size.width > dstImg.width ||
        size.height > dstImg.height ||
        dstPt.x > dstImg.width - size.width ||
        dstPt.y > dstImg.height - size.height) {
        throw new RangeError('out of range destination coordinates for image copy');
    }

    const srcData = srcImg.data;
    const dstData = dstImg.data;

    assert(srcData !== dstData);

    for (let y = 0; y < size.height; y++) {
        const srcOffset = ((srcPt.y + y) * srcImg.width + srcPt.x) * channels;
        const dstOffset = ((dstPt.y + y) * dstImg.width + dstPt.x) * channels;
        for (let i = 0; i < size.width * channels; i++) {
            dstData[dstOffset + i] = srcData[srcOffset + i];
        }
    }

    return dstImg;
}

export class AlphaImage {
    width: number;
    height: number;
    data: Uint8Array | Uint8ClampedArray;

    constructor(size: Size, data?: Uint8Array | Uint8ClampedArray) {
        createImage(this, size, 1, data);
    }

    resize(size: Size) {
        resizeImage(this, size, 1);
    }

    clone() {
        return new AlphaImage({width: this.width, height: this.height}, new Uint8Array(this.data));
    }

    static copy(srcImg: AlphaImage, dstImg: AlphaImage, srcPt: Point, dstPt: Point, size: Size) {
        copyImage(srcImg, dstImg, srcPt, dstPt, size, 1);
    }
}

// Not premultiplied, because ImageData is not premultiplied.
// UNPACK_PREMULTIPLY_ALPHA_WEBGL must be used when uploading to a texture.
export class RGBAImage {
    width: number;
    height: number;
    data: Uint8Array | Uint8ClampedArray;

    constructor(size: Size, data?: Uint8Array | Uint8ClampedArray) {
        createImage(this, size, 4, data);
    }

    resize(size: Size) {
        resizeImage(this, size, 4);
    }

    clone() {
        return new RGBAImage({width: this.width, height: this.height}, new Uint8Array(this.data));
    }

    static copy(srcImg: RGBAImage | ImageData, dstImg: RGBAImage, srcPt: Point, dstPt: Point, size: Size) {
        copyImage(srcImg, dstImg, srcPt, dstPt, size, 4);
    }
}

register('AlphaImage', AlphaImage);
register('RGBAImage', RGBAImage);
