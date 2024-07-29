import { Service, ServiceOptions } from "graphscript-core";
export type CallbackFunction = (prop: any, setting: StreamSettings) => any;
export type StreamSettings = {
    keys?: string[];
    callback?: CallbackFunction | number;
    lastRead?: number;
    [key: string]: any;
};
export type ObjectStreamInfo = {
    [key: string]: {
        object: {
            [key: string]: any;
        };
        settings: {
            keys?: string[];
            callback?: Function | number;
            lastRead?: number;
            [key: string]: any;
        };
        onupdate?: (data: any, streamSettings: any) => void;
        onclose?: (streamSettings: any) => void;
    };
};
export type StreamFunctionMap = {
    [key: string]: CallbackFunction;
};
export type StreamConfig = {
    object: any;
    settings: StreamSettings;
    onupdate?: (update: any, settings: StreamSettings) => void;
    onclose?: (settings: StreamSettings) => void;
};
export declare class ObjectStream extends Service {
    name: string;
    static STREAMLATEST: number;
    static STREAMALLLATEST: number;
    streamSettings: ObjectStreamInfo;
    constructor(options?: ServiceOptions);
    streamFunctions: any;
    setStreamFunc: (name: string, key: string, callback?: number | Function) => boolean;
    addStreamFunc: (name: any, callback?: (data: any) => void) => void;
    setStream: (object?: {}, settings?: {
        keys?: string[];
        callback?: Function | number;
    }, streamName?: string, onupdate?: (update: any, settings: any) => void, onclose?: (settings: any) => void) => {
        object: {
            [key: string]: any;
        };
        settings: {
            keys?: string[];
            callback?: Function | number;
            lastRead?: number;
            [key: string]: any;
        };
        onupdate?: (data: any, streamSettings: any) => void;
        onclose?: (streamSettings: any) => void;
    };
    removeStream: (streamName: string, key?: string) => boolean;
    updateStreamData: (streamName: any, data?: {}) => false | {
        [key: string]: any;
    };
    getStreamUpdate: (streamName: string) => {};
    getAllStreamUpdates: () => {};
    streamLoop: {
        __operator: () => {};
        __node: {
            loop: number;
        };
    };
}
export declare function testObjectStream(): void;
