export declare class InputBuffer {
    private _raw;
    constructor(values?: any[]);
    get buffer(): any[];
    set buffer(inputArray: any[]);
    clear(): void;
    push(...input: any): void;
    get length(): number;
    set length(length: number);
}
export declare class CircularBuffer {
    private _raw;
    private _size;
    onfilled?: () => void;
    _count: number;
    constructor(size: number, values?: any[]);
    get buffer(): any[];
    clear(): void;
    set buffer(inputArray: any[]);
    push(...input: any): void;
    private pushArray;
    get length(): number;
    set length(length: number);
}
export type DelayedGetterRules = {
    [key: string]: ('state' | true) | 'inpbuf' | {
        type: 'circbuf';
        length: number;
    };
};
export declare class DelayBuffer {
    private _buffer;
    _rules: DelayedGetterRules;
    private _pollInterval?;
    private _pollTimeout?;
    onupdate?: (buffer: {
        [key: string]: any;
    }) => void;
    constructor(rules: DelayedGetterRules, poll?: number);
    setRules(rules: DelayedGetterRules): void;
    clearRules(rules: string[]): void;
    set buffer(inputs: {
        [key: string]: any;
    });
    get buffer(): {
        [key: string]: any;
    };
    clear(): void;
    startPolling(): void;
    stopPolling(): void;
}
export declare class DelayBufferManager {
    private buffers;
    private pollInterval;
    private pollTimeout?;
    onupdate?: (aggregatedBuffer: {
        [key: string]: any;
    }) => void;
    constructor(pollInterval: number);
    createBuffer(name: string, rules: DelayedGetterRules, individualPollInterval?: number): void;
    deleteBuffer(name: string): void;
    get(name: string): DelayBuffer | undefined;
    updateBuffer(name: string, updates: {
        [key: string]: any;
    }): void;
    private aggregateBuffers;
    startPolling(): void;
    stopPolling(): void;
}
