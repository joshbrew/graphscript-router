import { loaders, Service, ServiceOptions } from "graphscript-core";

export type CallbackFunction = (prop: any, setting: StreamSettings) => any;

export type  StreamSettings = {
    keys?: string[]; // Keys to watch on the object
    callback?: CallbackFunction | number; // Callback function for processing updates
    lastRead?: number; // Last read index/value
    [key: string]: any; // Additional properties for nested settings
}


export type ObjectStreamInfo = {
    [key:string]:{
        object:{[key:string]:any}, //the object we want to watch
        settings:{ //the settings for how we are handling the transform on the watch loop
            keys?: string[]
            callback?:Function|number,
            lastRead?:number,
            [key:string]:any
        },
        onupdate?:(data:any,streamSettings:any)=>void,
        onclose?:(streamSettings:any)=>void
    }
}

export type  StreamFunctionMap =  {
    [key: string]: CallbackFunction; // Mapping of stream functions
}

export type  StreamConfig = {
    object: any; // The object being streamed
    settings: StreamSettings; // Settings for the stream
    onupdate?: (update: any, settings: StreamSettings) => void; // Function called on update
    onclose?: (settings: StreamSettings) => void; // Function called on close
}

//more generalized object streaming
export class ObjectStream extends Service {

    name="objectstream";

    //more rudimentary object streaming than the above sessions
	static STREAMLATEST = 0;
	static STREAMALLLATEST = 1;
    streamSettings:ObjectStreamInfo = {};

    constructor(options?:ServiceOptions) {
        super(options);
        this.setLoaders(loaders);
        this.load(this);
    }

    streamFunctions:any = {
        //these default functions will only send the latest of an array or value if changes are detected, and can handle single nested objects 
        // you can use the setting to create watch properties (e.g. lastRead for these functions). 
        // All data must be JSONifiable
        allLatestValues:(prop:any, setting:any)=>{ //return arrays of hte latest values on an object e.g. real time data streams. More efficient would be typedarrays or something
            let result:any = undefined;

            if(Array.isArray(prop)) {
                if(prop.length !== setting.lastRead) {
                    result = prop.slice(setting.lastRead);
                    setting.lastRead = prop.length;
                }
            }
            else if (typeof prop === 'object') {
                result = {};
                for(const p in prop) {
                    if(Array.isArray(prop[p])) {
                        if(typeof setting === 'number') setting = {[p]:{lastRead:undefined}}; //convert to an object for the sub-object keys
                        else if(!setting[p]) setting[p] = {lastRead:undefined};
                        
                        if(prop[p].length !== setting[p].lastRead) {
                            result[p] = prop[p].slice(setting[p].lastRead);
                            setting[p].lastRead = prop[p].length;
                        }
                    }
                    else {
                        if(typeof setting === 'number') setting = {[p]:{lastRead:undefined}}; //convert to an object for the sub-object keys
                        else if(!setting[p]) setting[p] = {lastRead:undefined};

                        if(setting[p].lastRead !== prop[p]) {
                            result[p] = prop[p];
                            setting[p].lastRead = prop[p];
                        }
                    }
                }
                if(Object.keys(result).length === 0) result = undefined;
            }
            else { 
                if(setting.lastRead !== prop) {
                    result = prop;
                    setting.lastRead = prop;
                } 
            }

            return result;

        },
        latestValue:(prop:any,setting:any)=>{
            let result:any = undefined;
            if(Array.isArray(prop)) {
                if(prop.length !== setting.lastRead) {
                    result = prop[prop.length-1];
                    setting.lastRead = prop.length;
                }
            }
            else if (typeof prop === 'object') {
                result = {};
                for(const p in prop) {
                    if(Array.isArray(prop[p])) {
                        if(typeof setting === 'number') setting = {[p]:{lastRead:undefined}}; //convert to an object for the sub-object keys
                        else if(!setting[p]) setting[p] = {lastRead:undefined};
                        
                        if(prop[p].length !== setting[p].lastRead) {
                            result[p] = prop[p][prop[p].length-1];
                            setting[p].lastRead = prop[p].length;
                        }
                    }
                    else {
                        if(typeof setting === 'number') setting = {[p]:{lastRead:undefined}}; //convert to an object for the sub-object keys
                        else if(!setting[p]) setting[p] = {lastRead:undefined};

                        if(setting[p].lastRead !== prop[p]) {
                            result[p] = prop[p];
                            setting[p].lastRead = prop[p];
                        }
                    }
                }
            }
            else { 
                if(setting.lastRead !== prop) {
                    result = prop;
                    setting.lastRead = prop;
                } 
            }

            return result;
        },
    };

	setStreamFunc = (
        name:string,
        key:string,
        callback:number|Function=this.streamFunctions.allLatestValues) => {
		if(!this.streamSettings[name].settings[key]) 
			this.streamSettings[name].settings[key] = {lastRead:0};
		
		if(callback === this.STREAMLATEST) 
			this.streamSettings[name].settings[key].callback = this.streamFunctions.latestValue; //stream the latest value 
		else if(callback === this.STREAMALLLATEST) 
			this.streamSettings[name].settings[key].callback = this.streamFunctions.allLatestValues; //stream all of the latest buffered data
		else if (typeof callback === 'string') 
			this.streamSettings[name].settings[key].callback = this.streamFunctions[callback]; //indexed functions
		else if (typeof callback === 'function')
			this.streamSettings[name].settings[key].callback = callback; //custom function

		if(!this.streamSettings[name].settings[key].callback) this.streamSettings[name].settings[key].callback = this.streamFunctions.allLatestValues; //default
		
        return true;
	}

	addStreamFunc = (name,callback=(data)=>{}) => {
		this.streamFunctions[name] = callback;
	}

	// 		object:{key:[1,2,3],key2:0,key3:'abc'}, 		// Object we are buffering data from
	//		settings:{
	//      	callback:0, 	// Default data streaming mode for all keys
	//			keys:['key','key2'], 	// Keys of the object we want to buffer into the stream
	// 			key:{
	//				callback:0 //specific modes for specific keys or can be custom functions
	// 				lastRead:0,	
	//			} //just dont name an object key 'keys' :P
	//		}
	setStream = (
		object={},   //the object you want to watch
		settings: {
			keys?: string[]
			callback?: Function|number
		}={}, //settings object to specify how data is pulled from the object keys
		streamName=`stream${Math.floor(Math.random()*10000000000)}`, //used to remove or modify the stream by name later
        onupdate?:(update:any,settings:any)=>void,
        onclose?:(settings:any)=>void
	) => {

		///stream all of the keys from the object if none specified
		if(settings.keys) { 
			if(settings.keys.length === 0) {
				let k = Object.keys(object);
				if(k.length > 0) {
					settings.keys = Array.from(k);
				}
			}
		} else {
			settings.keys = Array.from(Object.keys(object));
		}

		this.streamSettings[streamName] = {
			object,
			settings,
            onupdate,
            onclose
		};

		// if(!settings.callback) settings.callback = this.STREAMALLLATEST;

        this.subscribe(streamName, (res:any)=>{ 
            if(this.streamSettings[streamName].onupdate) 
                (this.streamSettings[streamName] as any).onupdate(res,this.streamSettings[streamName]); 
        });

		settings.keys.forEach((prop) => {
			if(settings[prop]?.callback)
				this.setStreamFunc(streamName,prop,settings[prop].callback);
			else
				this.setStreamFunc(streamName,prop,settings.callback);
		});
        

		return this.streamSettings[streamName];

	}

	//can remove a whole stream or just a key from a stream if supplied
	removeStream = (streamName:string,key?:string) => {
		if(streamName && this.streamSettings[streamName] && !key) {
            if(this.streamSettings[streamName].onclose) 
                (this.streamSettings[streamName] as any).onclose(this.streamSettings[streamName]);
            this.unsubscribe(streamName); //remove the subscriptions to this stream
            delete this.streamSettings[streamName];
        } else if (key && this.streamSettings[streamName]?.settings?.keys) {
			let idx = (this.streamSettings[streamName].settings.keys as any).indexOf(key);
			if(idx > -1) 
            (this.streamSettings[streamName].settings.keys as any).splice(idx,1);
			if(this.streamSettings[streamName].settings[key]) 
				delete this.streamSettings[streamName].settings[key];
            return true;
		}
        return false;
	}

	//can update a stream object by object assignment using the stream name (if you don't have a direct reference)
	updateStreamData = (streamName, data={}) => {
		if(this.streamSettings[streamName]) {
			Object.assign(this.streamSettings[streamName].object,data);
			return this.streamSettings[streamName].object;
		}
		return false;
	} 

    getStreamUpdate = (streamName:string) => {
        if(!this.streamSettings[streamName]) return;
        let streamUpdate = {};
        (this.streamSettings[streamName].settings.keys as any).forEach((key) => {
            if(this.streamSettings[streamName].settings[key]) {
                let data = this.streamSettings[streamName].settings[key].callback(
                    this.streamSettings[streamName].object[key],
                    this.streamSettings[streamName].settings[key]
                );
                if(data !== undefined) streamUpdate[key] = data; //overlapping props will be overwritten (e.g. duplicated controller inputs)
            }
        });
        this.setState({[streamName]:streamUpdate}); // the streamName is subscribable to do whatever you want with
        return streamUpdate;
    }

    getAllStreamUpdates = () => {
        let updateObj = {};

        for(const streamName in this.streamSettings) {
            let streamUpdate = this.getStreamUpdate(streamName);
            Object.assign(updateObj,streamUpdate);
        }

        return updateObj;
        
	}

    // Service loop to engage the stream updates
    //service.run('streamLoop'); //to engage the loop
    streamLoop = {
        __operator:this.getAllStreamUpdates,
        __node:{loop:10}
    }



}




// Test function to demonstrate usage and behaviors
export function testObjectStream() {
    const objectStream = new ObjectStream();

    // Simulate two users with separate objects
    const user1Object = {
        timeSeries: [],
        currentButtonState: 'UP',
        buttonInputBuffer: []
    } as any;

    const user2Object = {
        timeSeries: [],
        currentButtonState: 'UP',
        buttonInputBuffer: []
    } as any;

    // Define onupdate and onclose callbacks for user1
    const onUpdateUser1 = (update: any, settings: StreamSettings) => {
        console.log('User1 update received:', update);
    };

    const onCloseUser1 = (settings: StreamSettings) => {
        console.log('User1 stream closed:', settings);
    };

    // Define onupdate and onclose callbacks for user2
    const onUpdateUser2 = (update: any, settings: StreamSettings) => {
        console.log('User2 update received:', update);
    };

    const onCloseUser2 = (settings: StreamSettings) => {
        console.log('User2 stream closed:', settings);
    };

    // Setting up streams for both users
    console.log('Setting up streams for user1Object and user2Object...');
    objectStream.setStream(
        user1Object,
        { keys: ['timeSeries', 'currentButtonState', 'buttonInputBuffer'], callback: ObjectStream.STREAMALLLATEST },
        'user1Stream',
        onUpdateUser1,
        onCloseUser1
    );

    objectStream.setStream(
        user2Object,
        { keys: ['timeSeries', 'currentButtonState', 'buttonInputBuffer'], callback: ObjectStream.STREAMALLLATEST },
        'user2Stream',
        onUpdateUser2,
        onCloseUser2
    );

    //objectSTream.get('streamLoop).__node.loop = 500; //can alter loop update rate (or just rewrite the streamLoop function yourself for more control)
    objectStream.run('streamLoop'); //10ms updates

    // Simulate user1 pushing updates
    setInterval(() => {
        console.log('User1 pushing updates...');
        const timestamp = new Date().toISOString();
        user1Object.timeSeries.push({ time: timestamp, value: Math.random() });
        user1Object.currentButtonState = user1Object.currentButtonState === 'UP' ? 'DOWN' : 'UP';
        user1Object.buttonInputBuffer.push({ state: user1Object.currentButtonState, time: timestamp });
    }, 1000);

    // Simulate user2 pushing updates
    setInterval(() => {
        console.log('User2 pushing updates...');
        const timestamp = new Date().toISOString();
        user2Object.timeSeries.push({ time: timestamp, value: Math.random() });
        user2Object.currentButtonState = user2Object.currentButtonState === 'UP' ? 'DOWN' : 'UP';
        user2Object.buttonInputBuffer.push({ state: user2Object.currentButtonState, time: timestamp });
    }, 1500);

    // Allow streams to run for a while, then close
    setTimeout(() => {
        console.log('Closing streams...');
        objectStream.removeStream('user1Stream');
        objectStream.removeStream('user2Stream');
        objectStream.get('streamLoop').looping = false;
    }, 10000);
}
