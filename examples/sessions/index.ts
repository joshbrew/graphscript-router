import {
  InputBuffer, CircularBuffer, DelayBuffer, DelayBufferManager,
} from '../../src/services/sessions/sessions'
import {
  testDelayBuffers,testDelayBufferManagers, testSessionManagers, testCombinedManagers, testCombinedManagersWithWebSocket
}  from '../../src/services/sessions/tests'
// Example usage

import './index.css'

//testDelayBuffers();
//testDelayBufferManager();
//testSessionManager();
//testCombinedManagers();
testCombinedManagersWithWebSocket();