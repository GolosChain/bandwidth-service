const core = require('gls-core-service');
const BasicService = core.services.Basic;
const env = require('../data/env');
const { GLS_CHANNEL_TTL } = env;

class Storage extends BasicService {
    constructor() {
        super();

        this._whitelistMap = new Map(); // user -> set of cids
        this._cidSet = new Set(); // set of cids
        this._timeoutMap = new Map(); // channelId -> last request
        this._cidToUserMap = new Map(); // cannelId -> user name
    }

    async start() {
        const interval = 1000 * 60 * 60; // one hour
        setInterval(this._cleanup.bind(this), interval);
    }

    _cleanup() {
        const now = Date.now();
        for ([channelId, lastRequestDate] of this._timeoutMap) {
            const shouldBeDeleted = now - lastRequestDate >= GLS_CHANNEL_TTL;

            if (shouldBeDeleted) {
                this._timeoutMap.delete(channelId);
                this._cidSet.delete(channelId);

                const username = this._cidToUserMap.get(channelId);

                if (username) {
                    const cidSet = this._whitelistMap.get(username);

                    cidSet.delete(channelId);
                    if (cidSet.size === 0) {
                        this._whitelistMap.delete(username);
                    }
                }
            }
        }
    }

    isStored({ user, channelId }) {
        const now = new Date();
        const stored = this._whitelistMap.has(user) || this._cidSet.has(channelId);

        if (channelId) {
            this._timeoutMap.set(channelId, now);
        }

        return stored;
    }

    addInMemoryDb({ user, channelId }) {
        const now = new Date();

        this._cidToUserMap.set(channelId, user);

        this._cidSet.add(channelId);

        let userCids = this._whitelistMap.get(user);

        if (userCids) {
            userCids.add(channelId);
        } else {
            userCids = new Set([channelId]);
        }

        this._whitelistMap.set(user, userCids);

        this._timeoutMap.set(channelId, now);
    }

    removeFromMemoryDb(user) {
        const cids = this._whitelistMap.get(user);

        if (cids) {
            for (let cid of cids) {
                this._cidSet.delete(cid);
                this._timeoutMap.delete(cid);
                this._cidToUserMap.delete(cid);
            }
        }

        this._whitelistMap.delete(user);
    }

    handleOffline({ user, channelId }) {
        this._cidSet.delete(channelId);
        this._cidToUserMap.delete(channelId);

        if (this._whitelistMap.has(user)) {
            const mappedSet = this._whitelistMap.get(user);

            mappedSet.delete(channelId);

            if (mappedSet.size === 0) {
                this._whitelistMap.delete(user);
            }
        }
    }
}

module.exports = Storage;
