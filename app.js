/**
 * Main application object
 */
function App() {

    // Stack of image layers. After user applies a filter to an image, updated image added as a new layer.
    // When user presses "Undo" button, last layer popped from this stack and goes to Redo stack.
    // This is an array of objects:
    // {
    //     canvas: <link to HTML5 canvas element with image data of uploaded file>
    //     type: <MIME type of uploaded file, like image/jpeg or image/png>
    // }
    let undoStack = [];

    // Stack of image layers, used to redo last undo operations. When user presses Undo button, layer popped from
    // undoStack to this stack. When user presses "Redo" button, image popped back from this stack to undoStack.
    // This is an array of objects of the same format as in undoStack.
    let redoStack = [];

    // Parameter values for "Flip vertically" and "Flip horizontally" filters
    const FLIP_HORIZONTAL = 1;
    const FLIP_VERTICAL = 2;

    // Initialization function
    this.init = function () {
        // Bind event handlers to HTML page handlers
        document.querySelector("#image").addEventListener("click", this.onUploadImageClick.bind(this));
        document.querySelector("#uploadFile").addEventListener("change", this.onSelectImage.bind(this));
        document.querySelector("#grayscaleBtn").addEventListener("click", this.onGrayscaleClick.bind(this));
        document.querySelector("#blurBtn").addEventListener("click", this.onBlurClick.bind(this));
        document.querySelector("#flipHorBtn").addEventListener("click", this.onFlipClick.bind(this, FLIP_HORIZONTAL));
        document.querySelector("#flipVertBtn").addEventListener("click", this.onFlipClick.bind(this, FLIP_VERTICAL));
        document.querySelector("#edgesBtn").addEventListener("click", this.onEdgesClick.bind(this));
        document.querySelector("#undoBtn").addEventListener("click", this.onUndoClick.bind(this));
        document.querySelector("#redoBtn").addEventListener("click", this.onRedoClick.bind(this));
        document.querySelector("#downloadBtn").addEventListener("click", this.onDownloadClick.bind(this));
    };

    // Runs when user clicks on image preview canvas to open "Upload image" window
    this.onUploadImageClick = function () {
        document.querySelector("#uploadFile").click();
    };

    // Runs when user selects an image file to upload
    this.onSelectImage = function (e) {
        if (e.target.files.length <= 0) {
            return;
        }
        const file = e.target.files[0];
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                undoStack = [{
                    canvas: canvas,
                    type: file.type,
                }];
                redoStack = [];
                this.updateImage();
            };
        };
        reader.readAsDataURL(file);
    };

    // Runs when user presses "Grayscale" button to apply grayscale filter to an image
    this.onGrayscaleClick = function () {
        if (undoStack.length<1) {
            return
        }
        const layer = this.createNextLayer();
        const ctx = layer.canvas.getContext("2d");
        let imgData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
        let pixels = imgData.data;
        for (let i = 0; i < pixels.length; i += 4) {
            let lightness = parseInt((pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3);
            pixels[i] = lightness;
            pixels[i + 1] = lightness;
            pixels[i + 2] = lightness;
        }
        ctx.putImageData(imgData, 0, 0);
        undoStack.push(layer);
        this.updateImage();
    };

    // Runs when user presses "Blur" button to apply gaussian blur filter with radius 6 to an image
    this.onBlurClick = function () {
        if (undoStack.length<1) {
            return
        }
        const layer = this.createNextLayer();
        const ctx = layer.canvas.getContext("2d");
        // Blur radius
        let blur = 6;

        let sum = 0;
        let delta = 5;
        let alpha_left = 1 / (2 * Math.PI * delta * delta);
        let step = blur < 3 ? 1 : 2;
        for (let y = -blur; y <= blur; y += step) {
            for (let x = -blur; x <= blur; x += step) {
                let weight = alpha_left * Math.exp(-(x * x + y * y) / (2 * delta * delta));
                sum += weight;
            }
        }
        let count = 0;
        for (let y = -blur; y <= blur; y += step) {
            for (let x = -blur; x <= blur; x += step) {
                count++;
                ctx.globalAlpha = alpha_left * Math.exp(-(x * x + y * y) / (2 * delta * delta)) / sum * blur;
                ctx.drawImage(layer.canvas, x, y);
            }
        }
        ctx.globalAlpha = 1;
        undoStack.push(layer);
        this.updateImage();
    };

    // Runs when user presses "Flip horizontally" and "Flip vertically" buttons to rotate image.
    // flipType - type of rotation: FLIP_HORIZONTAL or FLIP_VERTICAL
    this.onFlipClick = function (flipType) {
        if (undoStack.length<1) {
            return
        }
        const layer = this.createNextLayer();
        const ctx = layer.canvas.getContext("2d");
        const posX = flipType === FLIP_HORIZONTAL ? layer.canvas.width * -1 : 0;
        const posY = flipType === FLIP_VERTICAL ? layer.canvas.height * -1 : 0;
        ctx.save();
        ctx.scale(flipType === FLIP_HORIZONTAL ? -1 : 1, flipType === FLIP_VERTICAL ? -1 : 1);
        ctx.drawImage(layer.canvas, posX, posY, layer.canvas.width, layer.canvas.height);
        ctx.restore();
        undoStack.push(layer);
        this.updateImage();
    };


    // Runs when user presses "Edges" button to apply edges detection algorithm to an image using Sobel operator
    this.onEdgesClick = function () {
        if (undoStack.length<1) {
            return
        }
        const layer = this.createNextLayer();
        const ctx = layer.canvas.getContext("2d");
        const imageData = ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height);
        var vertical = convoluteFloat32(imageData,
            [-1, -2, -1,
                0, 0, 0,
                1, 2, 1], false);
        var horizontal = convoluteFloat32(imageData,
            [-1, 0, 1,
                -2, 0, 2,
                -1, 0, 1], false);
        var id = new ImageData(vertical.width, vertical.height);
        for (var i = 0; i < id.data.length; i += 4) {
            var v = Math.abs(vertical.data[i]);
            id.data[i] = v;
            var h = Math.abs(horizontal.data[i]);
            id.data[i + 1] = h
            id.data[i + 2] = (v + h) / 4;
            id.data[i + 3] = 255;
        }

        ctx.putImageData(id, 0, 0);
        undoStack.push(layer);
        this.updateImage();

        // Helper function to apply sobel operator
        function convoluteFloat32(pixels, weights, opaque) {
            var side = Math.round(Math.sqrt(weights.length));
            var halfSide = Math.floor(side / 2);

            var src = pixels.data;
            var sw = pixels.width;
            var sh = pixels.height;

            var w = sw;
            var h = sh;
            var output = {
                width: w, height: h, data: new Float32Array(w * h * 4)
            };
            var dst = output.data;

            var alphaFac = opaque ? 1 : 0;

            for (var y = 0; y < h; y++) {
                for (var x = 0; x < w; x++) {
                    var sy = y;
                    var sx = x;
                    var dstOff = (y * w + x) * 4;
                    var r = 0, g = 0, b = 0, a = 0;
                    for (var cy = 0; cy < side; cy++) {
                        for (var cx = 0; cx < side; cx++) {
                            var scy = Math.min(sh - 1, Math.max(0, sy + cy - halfSide));
                            var scx = Math.min(sw - 1, Math.max(0, sx + cx - halfSide));
                            var srcOff = (scy * sw + scx) * 4;
                            var wt = weights[cy * side + cx];
                            r += src[srcOff] * wt;
                            g += src[srcOff + 1] * wt;
                            b += src[srcOff + 2] * wt;
                            a += src[srcOff + 3] * wt;
                        }
                    }
                    dst[dstOff] = r;
                    dst[dstOff + 1] = g;
                    dst[dstOff + 2] = b;
                    dst[dstOff + 3] = a + alphaFac * (255 - a);
                }
            }
            return output;
        }
    };

    // Runs when user presses "Undo" button to remove last applied filter by removing last layer from "undoStack"
    this.onUndoClick = function () {
        if (undoStack.length > 1) {
            redoStack.push(undoStack.pop());
            this.updateImage();
        }
    };

    // Runs when user presses "Redo" button to revert last Undo operation
    this.onRedoClick = function () {
        if (redoStack.length > 0) {
            undoStack.push(redoStack.pop());
            this.updateImage();
        }
    };

    // Runs when user presses "Download" button to get resulting image with applied filters
    this.onDownloadClick = function () {
        if (undoStack.length < 1) {
            return;
        }
        const layer = undoStack[undoStack.length - 1];
        const link = document.createElement('a');
        link.download = 'result.' + layer.type.split("/").pop();
        link.href = layer.canvas.toDataURL();
        link.click();
    };

    // Method used to redraw image from last layer of undoStack each time, when stack changes.
    this.updateImage = function () {
        if (undoStack.length < 1) {
            return
        }
        let layer = undoStack[undoStack.length - 1];
        let data = layer.canvas.toDataURL(layer.type);
        document.querySelector("#image").style.backgroundImage = "url('" + data.replace(/(\r\n|\n|\r)/gm, "") + "')";
        document.querySelector("#image").innerHTML = "";
    };

    // Method used to create new layer in undoStack on top of current layer, which contains copy of current layer
    // Returns new layer.
    this.createNextLayer = function () {
        const layer = undoStack[undoStack.length - 1];
        const dstCanvas = document.createElement('canvas');
        dstCanvas.width = layer.canvas.width;
        dstCanvas.height = layer.canvas.height;
        const dstCtx = dstCanvas.getContext('2d');
        dstCtx.drawImage(layer.canvas, 0, 0);
        return {
            canvas: dstCanvas,
            type: layer.type,
            data: layer.data
        }
    }
}
