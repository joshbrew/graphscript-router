export class InputBuffer {
    private _raw: any[] = [];

    constructor(values?: any[]) {
        if (values) this._raw = [...values];
    }

    get buffer() {
        const currentBuffer = this._raw;
        this._raw = [];
        return currentBuffer;
    }

    set buffer(inputArray) {
        if (Array.isArray(inputArray)) {
            this._raw.push(...inputArray);
        } else {
            throw new Error("Input must be an array");
        }
    }

    clear() {
        this._raw.length = 0;
    }

    push(...input: any) {
        if (input.length > 1)
            this._raw.push(...input);
        else if (Array.isArray(input[0])) this._raw.push(...input[0]);
        else this._raw.push(input[0]);
    }

    get length() {
        return this._raw.length;
    }

    set length(length: number) {
        this._raw.length = length;
    }
}

export class CircularBuffer {
    private _raw: any[];
    private _size: number;
    public onfilled?: () => void;
    _count = 0;

    constructor(size: number, values?: any[]) {
        if (size <= 0) {
            throw new Error("Size must be greater than 0");
        }

        this._size = size;
        this._raw = new Array(size);

        if (values) {
            this.push(values);
        }
    }

    get buffer() {
        if (this._count < this._size) return this._raw.slice(this._size - this._count); //get only the used part of the buffer
        return [...this._raw];
    }

    clear() {
        this._raw.length = 0;
    }

    set buffer(inputArray: any[]) {
        this.push(inputArray);
    }

    push(...input: any) {
        if (input.length > 1) {
            this.pushArray(input);
        } else if (Array.isArray(input[0])) {
            this.pushArray(input[0]);
        } else {
            if (this._raw.length >= this._size) {
                this._raw.splice(0, 1);
            }
            this._raw.push(input[0]);

            if (this._raw.length === this._size && this.onfilled) {
                this.onfilled();
            }
            else if (this._count < this._size) this._count++;
        }
    }

    private pushArray(inputs: any[]) {
        const newEntriesLength = inputs.length;
        const totalLength = this._raw.length + newEntriesLength;

        if (totalLength > this._size) {
            this._raw.splice(0, totalLength - this._size);
        }
        this._raw.push(...inputs);
        if (this._raw.length === this._size && this.onfilled) {
            this.onfilled();
        } else if (this._count < this._size) {
            this._count += inputs.length; if (this._count > this._size) this._count = this._size;
        }
    }


    get length() {
        return this._count;
    }

    set length(length: number) {
        if (length < 0 || length > this._size) {
            throw new Error(`Length must be between 0 and ${this._size}`);
        }
        this._count = length;
    }
}

export type DelayedGetterRules = { [key: string]: ('state' | true) | 'inpbuf' | { type: 'circbuf', length: number } };

export class DelayBuffer {
    private _buffer: { [key: string]: any } = {};
    bufferHasData?: boolean;
    _rules: DelayedGetterRules;
    private _pollInterval?: number;
    private _pollTimeout?: any;
    public onupdate?: (buffer: { [key: string]: any }) => void;
    public prevState: { [updated: string]: any }

    constructor(
        rules: DelayedGetterRules,
        poll?: number // milliseconds
    ) {
        this._pollInterval = poll;

        this.setRules(rules);
    }

    setRules(rules: DelayedGetterRules) { //additional watch keys, DB will only track these values, not all you supply
        if (this._rules) Object.assign(this._rules, rules);
        else this._rules = rules;
    }

    clearRules(rules: string[]) {
        for (const key of rules) delete this._rules[key];
    }

    set buffer(inputs: { [key: string]: any }) {
        for (const key in inputs) {
            const rule = this._rules[key];
            if (!rule) continue;
            const inputValue = inputs[key];

            if (rule === 'state' || rule === true) {
                this._buffer[key] = inputValue;
                this.bufferHasData = true;
            } else if (rule === 'inpbuf') {
                if (!this._buffer[key]) {
                    this._buffer[key] = new InputBuffer();
                }
                this._buffer[key].push(inputValue);
                this.bufferHasData = true;
            } else if (rule?.type === 'circbuf') {
                if (!this._buffer[key]) {
                    this._buffer[key] = new CircularBuffer(rule.length);
                }
                this._buffer[key].push(inputValue);
                this.bufferHasData = true;
            }
        }
    }

    get buffer() {
        const currentBuffer: { [key: string]: any } = {};
        for (const key in this._buffer) {
            if (this._buffer[key] === undefined) continue;
            if (this._buffer[key]?._raw) {
                currentBuffer[key] = this._buffer[key].buffer;
                this._buffer[key].clear();;
            } else {
                currentBuffer[key] = this._buffer[key];
                delete this._buffer[key];
            }
        }
        this.bufferHasData = false;
        return currentBuffer;
    }

    clear() {
        this._buffer = {};
        this.bufferHasData = false;
    }

    startPolling(onupdate?: (buffer: { [key: string]: any }) => void) {
        if (onupdate) this.onupdate = onupdate;
        if (this._pollInterval && !this._pollTimeout) {
            this._pollTimeout = setInterval(() => {
                if (this.bufferHasData && this.onupdate) {
                    const update = this.buffer; //getter
                    this.prevState = update;
                    this.onupdate(update);
                    this.clear(); //clear after polling
                }
            }, this._pollInterval);
        }
    }

    stopPolling() {
        if (this._pollTimeout) {
            clearInterval(this._pollTimeout);
            this._pollTimeout = undefined;
        }
    }
}


export class DelayBufferManager {
    private buffers: { [key: string]: DelayBuffer } = {};
    private pollInterval: number;
    private pollTimeout?: any;
    public onupdate?: (aggregatedBuffer: { [name: string]: { [updatedProp: string]: any } }) => void;
    public prevState: { [name: string]: { [updatedProp: string]: any } }

    constructor(pollInterval: number) {
        this.pollInterval = pollInterval;
    }

    createBuffer(name: string, rules: DelayedGetterRules, individualPollInterval?: number) {
        if (this.buffers[name]) {
            throw new Error(`Buffer with name ${name} already exists`);
        }
        const buffer = new DelayBuffer(rules, individualPollInterval);
        this.buffers[name] = buffer;
    }

    deleteBuffer(name: string) {
        delete this.buffers[name];
    }

    get(name: string): DelayBuffer | undefined {
        return this.buffers[name];
    }

    updateBuffer(name: string, updates: { [key: string]: any }) {
        if (this.buffers[name])
            this.buffers[name].buffer = updates; //will load this into the delaybuffer
        else throw new Error("No buffer found of name " + name);
    }

    private aggregateBuffers() {
        const aggregatedBuffer: { [bufferName: string]: { [updatedProp: string]: any } } = {};
        for (const key in this.buffers) {
            if (this.buffers[key].bufferHasData) {
                const bufferData = this.buffers[key].buffer;
                aggregatedBuffer[key] = bufferData;
                this.buffers[key].clear();
            }
        }
        this.prevState = aggregatedBuffer;
        if (this.onupdate && Object.keys(aggregatedBuffer).length > 0) {
            this.onupdate(aggregatedBuffer);
        }
    }

    startPolling(onupdate?: (buffer: { [key: string]: any }) => void) {
        if (onupdate) this.onupdate = onupdate;
        if (this.pollInterval && !this.pollTimeout) {
            this.pollTimeout = setInterval(() => {
                this.aggregateBuffers();
            }, this.pollInterval);
        }
    }

    stopPolling() {
        if (this.pollTimeout) {
            clearInterval(this.pollTimeout);
            this.pollTimeout = undefined;
        }
    }
}