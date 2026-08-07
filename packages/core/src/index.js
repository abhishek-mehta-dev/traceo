"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TraceoCore = void 0;
class TraceoCore {
    sink;
    config;
    constructor(sink, config) {
        this.sink = sink;
        this.config = config;
    }
    async capture(event) {
        if (!this.config.enabled) {
            return;
        }
        await this.sink.capture(event);
    }
}
exports.TraceoCore = TraceoCore;
//# sourceMappingURL=index.js.map