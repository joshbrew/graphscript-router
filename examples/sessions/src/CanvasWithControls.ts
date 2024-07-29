//@ts-ignore
import css from "./CanvasWithControls.css" //uncomment if using bundler and comment out the fetch operations
//@ts-ignore
import html from "./CanvasWithControls.html"

//let css, html; //comment out if importing above

export type DrawEventData = {
    x: number;
    y: number;
    zoom: number;
    color: string;
    timestamp: number;
    penMode: 'line' | 'pixel';
    penSize: number;
    lastX?: number;
    lastY?: number;
    isDrawing: boolean;
    translateX: number;
    translateY: number;
    scale: number;
    ct?:number
};

export class CanvasWithControls extends HTMLElement {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    canvasWidth: number;
    canvasHeight: number;
    lineWidth: number;
    color: string;
    scale: number;
    translateX: number;
    translateY: number;
    isDrawing: boolean;
    isPanning: boolean;
    isLineDrawingMode: boolean;
    fetch?: any;
    lastX?: number;
    lastY?: number;
    initialX: number;
    initialY: number;
    drawHandlers: ((detail: any) => void)[];

    constructor() {
        super();

        this.canvasWidth = 800;
        this.canvasHeight = 600;
        this.lineWidth = 5;
        this.color = "#000000";
        this.scale = 1;
        this.translateX = 0;
        this.translateY = 0;
        this.isDrawing = false;
        this.isPanning = false;
        this.isLineDrawingMode = true;
        this.drawHandlers = [];

        this.attachShadow({ mode: "open" });
    }

    static get observedAttributes() {
        return ['width', 'height', 'controls'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'width') {
            this.canvasWidth = parseInt(newValue);
            if (this.canvas) {
                this.canvas.width = this.canvasWidth;
                this.ctx.lineWidth = this.lineWidth;
            }
        } else if (name === 'height') {
            this.canvasHeight = parseInt(newValue);
            if (this.canvas) {
                this.canvas.height = this.canvasHeight;
                this.ctx.lineWidth = this.lineWidth;
            }
        } else if (name === 'controls') {
            if (newValue && newValue !== 'false') {
                (this.shadowRoot as any).getElementById('controls-container').style.display = '';
            } else {
                (this.shadowRoot as any).getElementById('controls-container').style.display = 'none';
            }
        }
    }

    setupCanvas() {
        this.canvas = (this.shadowRoot as any).getElementById("canvas") as HTMLCanvasElement;
        this.ctx = this.canvas.getContext("2d") as CanvasRenderingContext2D;
        this.canvas.width = this.canvasWidth;
        this.canvas.height = this.canvasHeight;
        this.ctx.lineWidth = this.lineWidth;
        this.ctx.strokeStyle = this.color;
    }

    setupEventListeners() {
        const colorPicker = (this.shadowRoot as any).getElementById("color-picker");
        colorPicker.addEventListener("input", (event) => {
            this.color = event.target.value;
            this.ctx.strokeStyle = event.target.value;
        });

        const clearButton = (this.shadowRoot as any).getElementById("clear-button");
        clearButton.addEventListener("click", () => {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        });

        const zoomRange = (this.shadowRoot as any).getElementById("zoom-range");
        zoomRange.addEventListener("input", (event) => {
            this.scale = parseFloat(event.target.value);
            this.canvas.style.transform = `scale(${this.scale})`;
        });

        const recenterButton = (this.shadowRoot as any).getElementById("recenter-button");
        recenterButton.addEventListener("click", () => {
            this.recenterCanvas();
        });

        this.canvas.addEventListener("mousedown", (event) => this.onMouseDown(event));
        this.canvas.addEventListener("mousemove", (event) => this.onMouseMove(event));
        this.canvas.addEventListener("mouseup", () => this.onMouseUp());
        this.canvas.addEventListener("mouseout", () => this.onMouseOut());

        (this.canvas.parentElement as HTMLElement).addEventListener("wheel", (event) => this.onZoom(event));
        (this.canvas.parentElement as HTMLElement).addEventListener("mouseup", () => this.onMouseUp());
        (this.canvas.parentElement as HTMLElement).addEventListener("mouseout", () => this.onMouseOut());
        (this.canvas.parentElement as HTMLElement).addEventListener("mousemove", (event) => this.onMouseMove(event));

        const toggleModeButton = (this.shadowRoot as any).getElementById("toggle-mode-button");
        toggleModeButton.addEventListener("click", () => this.toggleDrawingMode());

        const lineWidthInput = (this.shadowRoot as any).getElementById("line-width");
        lineWidthInput.addEventListener("input", (event) => {
            this.lineWidth = parseInt(event.target.value);
            this.ctx.lineWidth = this.lineWidth;
        });
    }

    recenterCanvas() {
        this.scale = 1;
        this.translateX = 0;
        this.translateY = 0;
        this.canvas.style.transform = `translate(0px, 0px) scale(1)`;
    }

    toggleDrawingMode() {
        this.isLineDrawingMode = !this.isLineDrawingMode;
        const toggleModeButton = (this.shadowRoot as any).getElementById("toggle-mode-button");
        const lineWidthLabel = (this.shadowRoot as any).getElementById('line-label');
        if (this.isLineDrawingMode) {
            toggleModeButton.innerHTML = "Line Mode";
            lineWidthLabel.innerHTML = "Line Width:";
            this.canvas.style.cursor = "crosshair";
        } else {
            toggleModeButton.innerHTML = "Pixel Mode";
            lineWidthLabel.innerHTML = "Pixel Size:";
            this.canvas.style.cursor = "default";
        }
    }

    onMouseDown(event) {
        if (event.button === 1 || event.altKey) {
            this.isPanning = true;
            this.initialX = event.clientX - this.translateX;
            this.initialY = event.clientY - this.translateY;
            this.canvas.style.cursor = "move";
        } else {
            this.isDrawing = true;
            const x = event.offsetX * (this.canvasWidth / this.canvas.clientWidth);
            const y = event.offsetY * (this.canvasHeight / this.canvas.clientHeight);
            if (this.isLineDrawingMode) {
                this.startLine(x, y);
            } else {
                this.drawPixel(x, y);
            }
        }
    }

    onMouseMove(event) {
        if (this.isDrawing) {
            const x = event.offsetX * (this.canvasWidth / this.canvas.clientWidth);
            const y = event.offsetY * (this.canvasHeight / this.canvas.clientHeight);
            if (this.isLineDrawingMode) {
                this.drawLine(x, y);
            } else {
                this.drawPixel(x, y);
            }
        } else if (this.isPanning) {
            this.translateX = event.clientX - this.initialX;
            this.translateY = event.clientY - this.initialY;
            this.canvas.style.transform = `translate(${this.translateX}px, ${this.translateY}px) scale(${this.scale})`;
        }
    }

    onMouseUp() {
        if (this.isDrawing) {
            this.notifyDrawHandlers({
                x: this.lastX || 0,
                y: this.lastY || 0,
                zoom: this.scale,
                color: this.color,
                timestamp: Date.now(),
                penMode: this.isLineDrawingMode ? 'line' : 'pixel',
                penSize: this.lineWidth,
                lastX: this.lastX,
                lastY: this.lastY,
                isDrawing: false,
                translateX: this.translateX,
                translateY: this.translateY,
                scale: this.scale
            });
        }
        this.isDrawing = false;
        this.canvas.style.cursor = this.isLineDrawingMode ? "crosshair" : "default";
        this.lastX = undefined;
        this.lastY = undefined;
    }

    onMouseOut() {
        if (this.isDrawing) {
            this.notifyDrawHandlers({
                x: this.lastX || 0,
                y: this.lastY || 0,
                zoom: this.scale,
                color: this.color,
                timestamp: Date.now(),
                penMode: this.isLineDrawingMode ? 'line' : 'pixel',
                penSize: this.lineWidth,
                lastX: this.lastX,
                lastY: this.lastY,
                isDrawing: false,
                translateX: this.translateX,
                translateY: this.translateY,
                scale: this.scale
            });
        }
        this.isDrawing = false;
        this.isPanning = false;
        this.canvas.style.cursor = "default";
    }

    onZoom(event) {
        event.preventDefault();
        const delta = event.deltaY > 0 ? -0.1 : 0.1;
        const newScale = Math.min(Math.max(0.1, this.scale + delta), 5);
        this.canvas.style.transform = `translate(${this.translateX}px, ${this.translateY}px) scale(${newScale})`;
        this.scale = newScale;
    }

    startLine(x, y) {
        this.ctx.lineCap = "round";
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        this.ctx.strokeStyle = this.color;
        this.ctx.lineWidth = this.lineWidth;
        this.lastX = x;
        this.lastY = y;

        this.notifyDrawHandlers({
            x: x,
            y: y,
            zoom: this.scale,
            color: this.color,
            timestamp: Date.now(),
            penMode: 'line',
            penSize: this.lineWidth,
            lastX: this.lastX,
            lastY: this.lastY,
            isDrawing: this.isDrawing,
            translateX: this.translateX,
            translateY: this.translateY,
            scale: this.scale
        });
    }

    drawLine(x, y) {
        if (this.lastX !== undefined && this.lastY !== undefined) {
            this.ctx.lineTo(x, y);
            this.ctx.stroke();
            this.notifyDrawHandlers({
                x: x,
                y: y,
                zoom: this.scale,
                color: this.color,
                timestamp: Date.now(),
                penMode: 'line',
                penSize: this.lineWidth,
                lastX: this.lastX,
                lastY: this.lastY,
                isDrawing: this.isDrawing,
                translateX: this.translateX,
                translateY: this.translateY,
                scale: this.scale
            });
            this.lastX = x;
            this.lastY = y;
        } else {
            this.startLine(x, y);
        }
    }

    drawPixel(x, y) {
        this.ctx.fillStyle = this.color;
        this.ctx.fillRect(
            x - this.lineWidth / 2,
            y - this.lineWidth / 2,
            this.lineWidth,
            this.lineWidth
        );
        this.notifyDrawHandlers({
            x: x,
            y: y,
            zoom: this.scale,
            color: this.color,
            timestamp: Date.now(),
            penMode: 'pixel',
            penSize: this.lineWidth,
            isDrawing: this.isDrawing,
            translateX: this.translateX,
            translateY: this.translateY,
            scale: this.scale
        });
    }

    nctr = 0;
    notifyDrawHandlers(detail: {
        x: number,
        y: number,
        zoom: number,
        color: string,
        timestamp: number,
        penMode: 'line' | 'pixel',
        penSize: number,
        lastX?: number,
        lastY?: number,
        isDrawing: boolean,
        translateX: number,
        translateY: number,
        scale: number,
        ct?:number
    }) {
        detail.ct = this.nctr++;
        this.drawHandlers.forEach(handler => handler(detail));
    }

    connectedCallback() {
        console.log((this.shadowRoot as any));
        (this.shadowRoot as any).innerHTML = `
        <style>
            ${css}
        </style>
        ${html}
        `;
        this.setupCanvas();
        this.setupEventListeners();
    }

    disconnectedCallback() {
        // Cleanup if necessary
    }

    replayActions(actions) {
        if (!Array.isArray(actions)) return;
        actions.forEach(action => {
            this.ctx.lineWidth = action.penSize;
            this.ctx.strokeStyle = action.color;
            this.ctx.fillStyle = action.color;
            this.translateX = action.translateX;
            this.translateY = action.translateY;
            this.scale = action.scale;
            this.canvas.style.transform = `translate(${this.translateX}px, ${this.translateY}px) scale(${this.scale})`;
            console.log(action.ct);
            if (action.penMode === 'line') {
                if (action.isDrawing === false) {
                    this.lastX = undefined;
                    this.lastY = undefined;
                } else {
                    if (this.lastX === undefined || this.lastY === undefined) {
                        this.startLine(action.x, action.y);
                    } else {
                        this.ctx.beginPath();
                        this.ctx.moveTo(this.lastX, this.lastY);
                        this.ctx.lineTo(action.x, action.y);
                        this.ctx.stroke();
                    }
                    this.lastX = action.lastX;
                    this.lastY = action.lastY;
                }
            } else {
                this.drawPixel(action.x, action.y);
            }

        });
    }

    subscribeDrawHandler(handler: (detail: any) => void) {
        this.drawHandlers.push(handler);
    }

    unsubscribeDrawHandler(handler: (detail: any) => void) {
        this.drawHandlers = this.drawHandlers.filter(h => h !== handler);
    }
}

customElements.define("canvas-with-controls", CanvasWithControls);
