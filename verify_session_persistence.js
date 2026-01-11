"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const store_1 = require("./src/cli/session/store");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const WORKSPACE = process.cwd();
const SESSION_FILE = path.join(WORKSPACE, '.github/copilot-cli-agents.json');
// Ensure clean state
if (fs.existsSync(SESSION_FILE)) {
    fs.unlinkSync(SESSION_FILE);
}
// 1. Instantiate SessionStore (loads file/creates empty)
const store = new store_1.SessionStore(WORKSPACE);
console.log('Initial Session Count:', store.sessionCount); // Should be 0
// 2. Set a session via the store
store.setCliSessionId('vscode-session-1', 'gemini', 'gemini-session-1');
console.log('Session stored via API:', store.getCliSessionId('vscode-session-1', 'gemini'));
// 3. Simulate external modification
const externalData = {
    version: 1,
    sessions: {
        'vscode-session-1': {
            'gemini': {
                'cliSessionId': 'gemini-session-EXTERNAL',
                'createdAt': new Date().toISOString(),
                'lastUsedAt': new Date().toISOString()
            }
        }
    }
};
// Write directly to file, bypassing the store instance in memory
fs.mkdirSync(path.dirname(SESSION_FILE), { recursive: true });
fs.writeFileSync(SESSION_FILE, JSON.stringify(externalData, null, 2));
console.log('External modification written to file.');
// 4. Check if store sees the change
const currentId = store.getCliSessionId('vscode-session-1', 'gemini');
console.log('Session ID returned by store:', currentId);
if (currentId === 'gemini-session-EXTERNAL') {
    console.log('SUCCESS: Store read the external change.');
    process.exit(0);
}
else {
    console.log('FAILURE: Store returned cached value instead of file value.');
    console.log('Expected: gemini-session-EXTERNAL');
    console.log('Actual:  ' + currentId);
    process.exit(1);
}
//# sourceMappingURL=verify_session_persistence.js.map