import {
  InputBuffer, CircularBuffer, DelayBuffer, DelayBufferManager,
  DelayedGetterRules,
} from '../../src/services/sessions/buffers'
import {
  testDelayBuffers, testDelayBufferManagers, testSessionManagers, testCombinedManagers
} from '../../src/services/sessions/tests'

import { SessionService } from '../../src/services/sessions/sessions.service'


import { CanvasWithControls } from './src/CanvasWithControls';
import './src/CanvasWithControls'



// Example usage

import './index.css'

//testDelayBuffers();
//testDelayBufferManager();
//testSessionManager();
//testCombinedManagers();

import {testManagerWS} from './testManagerWS'

import {testSessionService} from './testService'

//use testManagerWS in server.js
//testManagerWS();

//use testSessionService() in server.js
testSessionService();
