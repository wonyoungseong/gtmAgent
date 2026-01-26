"use strict";
/**
 * Orchestrator Module
 * 워크플로우 조율 및 상태 관리
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowRunner = exports.workflowReducer = exports.createInitialState = exports.clearAllStateManagers = exports.removeStateManager = exports.getStateManager = exports.WorkflowStateManager = void 0;
var state_1 = require("./state");
Object.defineProperty(exports, "WorkflowStateManager", { enumerable: true, get: function () { return state_1.WorkflowStateManager; } });
Object.defineProperty(exports, "getStateManager", { enumerable: true, get: function () { return state_1.getStateManager; } });
Object.defineProperty(exports, "removeStateManager", { enumerable: true, get: function () { return state_1.removeStateManager; } });
Object.defineProperty(exports, "clearAllStateManagers", { enumerable: true, get: function () { return state_1.clearAllStateManagers; } });
Object.defineProperty(exports, "createInitialState", { enumerable: true, get: function () { return state_1.createInitialState; } });
Object.defineProperty(exports, "workflowReducer", { enumerable: true, get: function () { return state_1.workflowReducer; } });
var workflow_1 = require("./workflow");
Object.defineProperty(exports, "WorkflowRunner", { enumerable: true, get: function () { return workflow_1.WorkflowRunner; } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvb3JjaGVzdHJhdG9yL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7O0dBR0c7OztBQUVILGlDQU9pQjtBQU5mLDZHQUFBLG9CQUFvQixPQUFBO0FBQ3BCLHdHQUFBLGVBQWUsT0FBQTtBQUNmLDJHQUFBLGtCQUFrQixPQUFBO0FBQ2xCLDhHQUFBLHFCQUFxQixPQUFBO0FBQ3JCLDJHQUFBLGtCQUFrQixPQUFBO0FBQ2xCLHdHQUFBLGVBQWUsT0FBQTtBQUdqQix1Q0FBNEM7QUFBbkMsMEdBQUEsY0FBYyxPQUFBIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqIE9yY2hlc3RyYXRvciBNb2R1bGVcclxuICog7JuM7YGs7ZSM66Gc7JqwIOyhsOycqCDrsI8g7IOB7YOcIOq0gOumrFxyXG4gKi9cclxuXHJcbmV4cG9ydCB7XHJcbiAgV29ya2Zsb3dTdGF0ZU1hbmFnZXIsXHJcbiAgZ2V0U3RhdGVNYW5hZ2VyLFxyXG4gIHJlbW92ZVN0YXRlTWFuYWdlcixcclxuICBjbGVhckFsbFN0YXRlTWFuYWdlcnMsXHJcbiAgY3JlYXRlSW5pdGlhbFN0YXRlLFxyXG4gIHdvcmtmbG93UmVkdWNlclxyXG59IGZyb20gJy4vc3RhdGUnO1xyXG5cclxuZXhwb3J0IHsgV29ya2Zsb3dSdW5uZXIgfSBmcm9tICcuL3dvcmtmbG93JztcclxuXHJcbi8vIFJlLWV4cG9ydCB0eXBlc1xyXG5leHBvcnQgdHlwZSB7XHJcbiAgV29ya2Zsb3dTdGF0ZSxcclxuICBXb3JrZmxvd0FjdGlvbixcclxuICBXb3JrZmxvd1BoYXNlLFxyXG4gIFdvcmtmbG93UHJvZ3Jlc3MsXHJcbiAgV29ya2Zsb3dDb25maWcsXHJcbiAgV29ya2Zsb3dSZXN1bHQsXHJcbiAgV29ya2Zsb3dTdW1tYXJ5LFxyXG4gIFdvcmtmbG93RXZlbnQsXHJcbiAgV29ya2Zsb3dFdmVudEhhbmRsZXIsXHJcbiAgVGFnU2VsZWN0aW9uLFxyXG4gIFRhZ0ZpbHRlclxyXG59IGZyb20gJy4uL3R5cGVzL3dvcmtmbG93JztcclxuIl19