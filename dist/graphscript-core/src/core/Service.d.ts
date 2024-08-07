import { Graph, GraphNode, GraphOptions } from "./Graph";
export type TypedArray = Int8Array | Uint8Array | Uint8ClampedArray | Int16Array | Uint16Array | Int32Array | Uint32Array | Float32Array | Float64Array;
export type ServiceMessage = {
    route?: string;
    args?: any;
    method?: string;
    node?: string | GraphNode;
    [key: string]: any;
};
export type ServiceOptions = GraphOptions & {
    services?: {
        [key: string]: Service | Function | {
            [key: string]: any;
        };
    };
    restrict?: {
        [key: string]: boolean;
    };
};
export declare class Service extends Graph {
    name: string;
    restrict?: {
        [key: string]: boolean;
    };
    constructor(options?: ServiceOptions);
    addServices: (services: {
        [key: string]: Graph | Service | Function | {
            [key: string]: any;
        };
    }) => void;
    handleMethod: (route: string, method: string, args?: any) => any;
    handleServiceMessage(message: ServiceMessage): any;
    handleGraphNodeCall(route: string | GraphNode, args: any): any;
    transmit: (...args: any[]) => any | void;
    receive: (...args: any[]) => any | void;
    pipe: (source: GraphNode | string, destination: string, endpoint?: string | any, method?: string, callback?: (res: any) => any | void) => number;
    pipeOnce: (source: GraphNode | string, destination: string, endpoint?: string | any, method?: string, callback?: (res: any) => any | void) => any;
    terminate: (...args: any) => void;
    isTypedArray: typeof isTypedArray;
    recursivelyAssign: (target: any, obj: any) => any;
    spliceTypedArray: typeof spliceTypedArray;
    ping: () => string;
    echo: (...args: any) => any;
    log: (...args: any) => boolean;
    error: (...args: any) => boolean;
}
export declare function isTypedArray(x: any): boolean;
export declare const recursivelyAssign: (target: any, obj: any) => any;
export declare function spliceTypedArray(arr: TypedArray, start: number, end?: number): TypedArray;
