import {
    InputBuffer, CircularBuffer, DelayBuffer, DelayBufferManager,
    SessionManager,
    DelayedGetterRules
} from './sessions'




export function testInputBuffer() {
    const inputBuffer = new InputBuffer();

    console.log("Initial buffer length:", inputBuffer.length); // Expect: 0

    inputBuffer.push(1);
    inputBuffer.push(2, 3);
    inputBuffer.push([4, 5]);

    console.log("Buffer after pushing elements:", inputBuffer.buffer); // Expect: [1, 2, 3, 4, 5]
    console.log("Buffer length after pushing elements:", inputBuffer.length); // Expect: 0 (buffer is cleared after access)

    inputBuffer.buffer = [6, 7, 8];
    console.log("Buffer after setting new values:", inputBuffer.buffer); // Expect: [6, 7, 8]
    console.log("Buffer length after setting new values:", inputBuffer.length); // Expect: 0 (buffer is cleared after access)

    inputBuffer.push(9);
    console.log("Buffer after pushing a single element:", inputBuffer.buffer); // Expect: [9]

    inputBuffer.clear();
    console.log("Buffer after clearing:", inputBuffer.buffer); // Expect: []
}

export function testCircularBuffer() {
    const circularBuffer = new CircularBuffer(3);

    console.log("Initial buffer length:", circularBuffer.length); // Expect: 0

    circularBuffer.push(1);
    circularBuffer.push(2);
    circularBuffer.push(3);

    console.log("Buffer after pushing elements:", circularBuffer.buffer); // Expect: [1, 2, 3]
    console.log("Buffer length after pushing elements:", circularBuffer.length); // Expect: 3

    circularBuffer.push(4);
    console.log("Buffer after pushing one more element (overflow):", circularBuffer.buffer); // Expect: [2, 3, 4]
    console.log("Buffer length after overflow:", circularBuffer.length); // Expect: 3

    circularBuffer.buffer = [5, 6];
    console.log("Buffer after setting new values (partial fill):", circularBuffer.buffer); // Expect: [4, 5, 6]
    console.log("Buffer length after setting new values:", circularBuffer.length); // Expect: 3

    circularBuffer.clear();
    console.log("Buffer after clearing:", circularBuffer.buffer); // Expect: []
    console.log("Buffer length after clearing:", circularBuffer.length); // Expect: 0

    circularBuffer.push([7, 8, 9, 10]);
    console.log("Buffer after pushing an array (overflow):", circularBuffer.buffer); // Expect: [8, 9, 10]
    console.log("Buffer length after pushing array:", circularBuffer.length); // Expect: 3
}


export const testDelayBuffers = () => {

    const delayBuffer = new DelayBuffer(
        {
        curState: 'state',
        inputs: 'inpbuf',
        inpHistory: { type: 'circbuf', length: 20 }
        },
        1000 // poll every 1000 milliseconds
    );
    
    const delayBuffer2 = new DelayBuffer(
        {
        curState: 'state',
        inputs: 'inpbuf',
        inpHistory: { type: 'circbuf', length: 100 }
        },
        5000 // poll every 5000 milliseconds
    );
    
    delayBuffer.onupdate = (buffer) => {
        console.log("Buffer updated:", buffer);
        delayBuffer2.buffer = JSON.parse(JSON.stringify(buffer));
    };
    
    
    delayBuffer2.onupdate = (buffer) => {
        console.log("Buffer2 updated:", buffer);
    };
    
    // Function to generate data 10 times per second
    const generateData = () => {
        const states = ['A', 'B', 'C', 'D'];
        setInterval(() => {
        let sourceObject = {} as any;
        sourceObject.curState = states[Math.floor(Math.random() * states.length)];
        sourceObject.inputs = Array.from({ length: 4 }, (v, i) => {
            if (i === 3) return sourceObject.curState;
            return states[Math.floor(Math.random() * states.length)];
        });
        sourceObject.inpHistory = sourceObject.inputs;
        delayBuffer.buffer = sourceObject;
        }, 100);
    };
    
    // Start generating data
    generateData();
    
    //start and then stop later
    delayBuffer.startPolling();
    delayBuffer2.startPolling();
    
    setTimeout(()=>{
        delayBuffer.stopPolling();
        delayBuffer2.stopPolling();
    },10000)
}

export const testDelayBufferManagers = () => {
    // Sample usage
    const delayBufferManager1 = new DelayBufferManager(1000); // aggregate poll every 1000 milliseconds
    const delayBufferManager2 = new DelayBufferManager(5000); // aggregate poll every 5000 milliseconds

    delayBufferManager1.createBuffer('session1', {
        curState: 'state',
        inputs: 'inpbuf',
        inpHistory: { type: 'circbuf', length: 20 },
    });

    delayBufferManager2.createBuffer('session2', {
        curState: 'state',
        inputs: 'inpbuf',
        inpHistory: { type: 'circbuf', length: 100 },
    });

    delayBufferManager1.onupdate = (aggregatedBuffer) => {
        console.log('Aggregated Buffer from Manager1 updated:', aggregatedBuffer);
        if (aggregatedBuffer['session1']) {
            delayBufferManager2.updateBuffer('session2',aggregatedBuffer['session1']); //will buffer this session
        }
    };

    delayBufferManager2.onupdate = (aggregatedBuffer) => {
        console.log('Aggregated Buffer from Manager2 updated:', aggregatedBuffer);
    };

    // Function to generate data 10 times per second
    const generateData = () => {
        const states = ['A', 'B', 'C', 'D'];
        setInterval(() => {
            let sourceObject = {} as any;
            sourceObject.curState = states[Math.floor(Math.random() * states.length)];
            sourceObject.inputs = Array.from({ length: 4 }, (v, i) => {
                if (i === 3) return sourceObject.curState;
                return states[Math.floor(Math.random() * states.length)];
            });
            sourceObject.inpHistory = sourceObject.inputs;
            delayBufferManager1.updateBuffer(
                'session1', 
                sourceObject
            );
        }, 100);
    };

    // Start generating data
    generateData();

    // Start polling
    delayBufferManager1.startPolling();
    delayBufferManager2.startPolling();

    // Stop polling after 10 seconds
    setTimeout(() => {
        delayBufferManager1.stopPolling();
        delayBufferManager2.stopPolling();
    }, 10000);
};



export function testSessionManagers() {
    // Example usage for two SessionManagers with different polling intervals
    const sessionManager1 = new SessionManager(1000); // global poll every 1000 milliseconds
    const sessionManager2 = new SessionManager(5000); // global poll every 5000 milliseconds

    const delayBufferRules = {
        buffer1: {
            curState: 'state',
            inputs: 'inpbuf',
            inpHistory: { type: 'circbuf', length: 20 },
        } as DelayedGetterRules,
        buffer2: {
            curState: 'state',
            inputs: 'inpbuf',
            inpHistory: { type: 'circbuf', length: 100 },
        } as DelayedGetterRules,
    };

    sessionManager1.createSession(
        'session1',
        'admin',
        delayBufferRules.buffer1,
        {
            password: 'secret',
        }
    );

    sessionManager2.createSession(
        'session2',
        'admin',
        delayBufferRules.buffer2
    );

    sessionManager1.setAdmin('session1', 'admin', 'user2');
    sessionManager1.addUserToSession('session1', 'user2', 'secret');
    sessionManager2.addUserToSession('session2', 'user2');

    //e.g. this is the clientside buffer, could use the delaybuffermanager actually or we should make the data copyable
    sessionManager1.onupdate = (aggregatedBuffers, sessions) => {
        console.log('Aggregated Buffer from SessionManager1:', aggregatedBuffers);
        if (aggregatedBuffers['session1']) {
            sessionManager2.updateBuffer('session2', aggregatedBuffers['session1'], 'admin');
        }
    };

    //e.g. this is 
    sessionManager2.onupdate = (aggregatedBuffers, sessions) => {
        console.log(
            'Aggregated Buffer from SessionManager2:', 
            aggregatedBuffers,
            "Split By Users:",
            sessionManager2.splitUpdatesByUser(aggregatedBuffers)
        );

    };

    // Function to generate data 10 times per second
    let interval;
    const generateData = () => {
        const states = ['A', 'B', 'C', 'D'];
        interval = setInterval(() => {
            let sourceObject = {} as any;
            sourceObject.curState = states[Math.floor(Math.random() * states.length)];
            sourceObject.inputs = Array.from({ length: 4 }, (v, i) => {
                if (i === 3) return sourceObject.curState;
                return states[Math.floor(Math.random() * states.length)];
            });
            sourceObject.inpHistory = sourceObject.inputs;

            sessionManager1.updateBuffer(
                'session1', 
                sourceObject, 
                'admin'
            );
        }, 100);
    };

    // Start generating data
    generateData();

    // Start polling
    sessionManager1.startPolling();
    sessionManager2.startPolling();

    // Stop polling after 10 seconds
    setTimeout(() => {
        clearInterval(interval);
        sessionManager1.stopPolling();
        sessionManager2.stopPolling();
    }, 10000);
}


export const testCombinedManagers = () => {
    // Create DelayBufferManager and SessionManager instances
    const delayBufferManager1 = new DelayBufferManager(1000); // aggregate poll every 1000 milliseconds
    const sessionManager2 = new SessionManager(5000); // global poll every 5000 milliseconds

    // Create buffers and sessions

    //e.g. the local user
    delayBufferManager1.createBuffer('session1', {
        curState: 'state',
        inputs: 'inpbuf',
        inpHistory: { type: 'circbuf', length: 20 },
    });

    //e.g. the serverside session receiving and returning updates
    sessionManager2.createSession(
        'session2',
        'admin',
        {
            curState: 'state',
            inputs: 'inpbuf',
            inpHistory: { type: 'circbuf', length: 100 },
        },
        {password: 'secret'}
    );

    sessionManager2.addUserToSession('session2', 'user2', 'secret'); //TODO: user tokens

    delayBufferManager1.onupdate = (aggregatedBuffer) => {
        console.log('Aggregated Buffer from Manager1 updated:', aggregatedBuffer);
        if (aggregatedBuffer['session1']) {
            sessionManager2.updateBuffer('session2', aggregatedBuffer['session1'], 'admin'); // update session2 buffer with session1 aggregated data
        }
    };

    sessionManager2.onupdate = (aggregatedBuffers, sessions) => {
        console.log(
            'Aggregated Buffer from SessionManager2:', 
            aggregatedBuffers,
            "Split By Users:",
            sessionManager2.splitUpdatesByUser(aggregatedBuffers)
        );
    };

    // Function to generate data 10 times per second for DelayBufferManager
    let interval;
    const generateDataForDelayBufferManager = () => {
        const states = ['A', 'B', 'C', 'D'];
        interval = setInterval(() => {
            let sourceObject = {} as any;
            sourceObject.curState = states[Math.floor(Math.random() * states.length)];
            sourceObject.inputs = Array.from({ length: 4 }, (v, i) => {
                if (i === 3) return sourceObject.curState;
                return states[Math.floor(Math.random() * states.length)];
            });
            sourceObject.inpHistory = sourceObject.inputs;
            delayBufferManager1.updateBuffer('session1', sourceObject);
        }, 100);
    };

    // Start generating data
    generateDataForDelayBufferManager();
    // Start polling
    delayBufferManager1.startPolling();
    sessionManager2.startPolling();

    // Stop polling after 10 seconds
    setTimeout(() => {
        clearInterval(interval);
        delayBufferManager1.stopPolling();
        sessionManager2.stopPolling();
    }, 10000);
};


export const testCombinedManagersWithWebSocket = () => {
    // Create DelayBufferManager instance
    const delayBufferManager1 = new DelayBufferManager(1000); // aggregate poll every 1000 milliseconds

    // Create WebSocket connection to the server
    const ws = new WebSocket('ws://localhost:8080/');

    // Handle incoming messages from the WebSocket server
    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        console.log('Received message from server:', message);

        if (message.route === 'update') {
            console.log('Split Updates by User:', message.data);
        }

        if(message.route === 'stopPolling') {
            ws.close();
        }
    };

    // Create session and add user to the session on the server
    ws.onopen = () => {
        console.log("Connected!");
        ws.send(JSON.stringify({
            route: 'createSession',
            args: [
                'session2', // sessionId
                'admin', // creatorId
                {
                    curState: 'state',
                    inputs: 'inpbuf',
                    inpHistory: { type: 'circbuf', length: 100 },
                }, // delayBufferRules
                { password:'secret' } // sessionRules
            ]
        }));

        ws.send(JSON.stringify({
            route: 'addUser',
            args: ['session2', 'user2', 'secret'] // sessionId, userId, password
        }));

        ws.send(JSON.stringify({
            route:'startPolling'
        }));


    // Start generating data
        generateDataForDelayBufferManager();
        // Start polling
        delayBufferManager1.startPolling();

        // Stop polling after 10 seconds
        setTimeout(() => {
            clearInterval(interval);
            delayBufferManager1.stopPolling();
            //ws.send(JSON.stringify({route:'stopPolling'}))
            //ws.close();
        }, 10000);
    };

    // Create buffers
    delayBufferManager1.createBuffer('session1', {
        curState: 'state',
        inputs: 'inpbuf',
        inpHistory: { type: 'circbuf', length: 20 },
    });

    delayBufferManager1.onupdate = (aggregatedBuffer) => {
        console.log('Aggregated Buffer from Manager1 updated:', aggregatedBuffer);
        if (aggregatedBuffer['session1']) {
            ws.send(JSON.stringify({ route: 'updateBuffer', args: ['session2', aggregatedBuffer['session1'], 'admin'] }));
        }
    };

    let interval;
    // Function to generate data 10 times per second for DelayBufferManager
    const generateDataForDelayBufferManager = () => {
        const states = ['A', 'B', 'C', 'D'];
        interval = setInterval(() => {
            let sourceObject = {} as any;
            sourceObject.curState = states[Math.floor(Math.random() * states.length)];
            sourceObject.inputs = Array.from({ length: 4 }, (v, i) => {
                if (i === 3) return sourceObject.curState;
                return states[Math.floor(Math.random() * states.length)];
            });
            sourceObject.inpHistory = sourceObject.inputs;
            delayBufferManager1.updateBuffer('session1', sourceObject);
        }, 100);
    };


};