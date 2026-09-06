import Bridge from '@stremio/stremio-core-web/bridge';

// Ensure window.onCoreEvent exists so initial messages from worker during boot do not fail
if (typeof window !== 'undefined' && !(window as any).onCoreEvent) {
    (window as any).onCoreEvent = () => undefined;
}

const worker = new Worker(`${process.env.COMMIT_HASH}/scripts/worker.js`);
const bridge = new Bridge(window, worker);

const createTransport = (): CoreTransport => {
    const init = (args: object): Promise<void> => {
        return bridge.call(['init'], [args]);
    };

    const getState = async (model: string): Promise<object> => {
        return (await bridge.call(['getState'], [model])) as any;
    };

    const dispatch = (action: DispatchAction, model?: string): Promise<void> => {
        return bridge.call(['dispatch'], [action, model, location.hash]);
    };

    const encodeStream = (stream: Stream): Promise<string> => {
        return bridge.call(['encodeStream'], [stream]);
    };

    const decodeStream = (stream: string): Promise<Stream> => {
        return bridge.call(['decodeStream'], [stream]);
    };

    const analytics = (event: object): Promise<void> => {
        return bridge.call(['analytics'], [event, location.hash]);
    };

    return {
        init,
        getState,
        dispatch,
        encodeStream,
        decodeStream,
        analytics,
    };
};

export default createTransport;
