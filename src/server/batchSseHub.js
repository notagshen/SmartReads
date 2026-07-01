const subscribers = new Map();

const sendEvent = (res, event, payload) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
};

export const publishBatchState = (state, getSnapshot) => {
    const targets = subscribers.get(state.id);
    if (!targets || targets.size === 0) return;

    const snapshot = getSnapshot(state);
    for (const res of targets) {
        sendEvent(res, 'state', snapshot);
    }
};

export const subscribeBatchState = ({ req, res, state, getSnapshot }) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
    });
    res.write(': connected\n\n');

    const targets = subscribers.get(state.id) || new Set();
    targets.add(res);
    subscribers.set(state.id, targets);
    sendEvent(res, 'state', getSnapshot(state));

    req.on('close', () => {
        targets.delete(res);
        if (targets.size === 0) subscribers.delete(state.id);
    });
};
