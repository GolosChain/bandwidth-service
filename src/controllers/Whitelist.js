const core = require('gls-core-service');
const BasicController = core.controllers.Basic;
const Whitelist = require('../model/Whitelist');

class WhitelistController extends BasicController {
    constructor({ connector }) {
        super({ connector });

        this._whitelistMap = new Map(); // user -> set of cids
        this._cidSet = new Set(); // set of cids
    }

    async _askRegService({ user }) {
        // TODO: implement call to service
        return true;
    }

    _addInMemoryDb({ user, channelId }) {
        this._cidSet.add(channelId);

        let userCids = this._whitelistMap.get(user);

        if (userCids) {
            userCids.add(channelId);
        } else {
            userCids = new Set([channelId]);
        }

        this._whitelistMap.set(user, userCids);
    }

    _removeFromMemoryDb(user) {
        const cids = this._whitelistMap.get(user);

        if (cids) {
            cids.forEach(cid => {
                this._cidSet.delete(cid);
            });
        }

        this._whitelistMap.delete(user);
    }

    async isAllowed({ channelId, user }) {
        // in memory -> allowed
        if (this._cidSet.has(channelId)) return true;

        user = await Whitelist.findOne({ user });

        // explicitly banned -> not allowed
        if (user && user.banned) {
            return false;
        }

        // in db -> allowed and should be stored in memory
        if (user && !user.banned) {
            this._addInMemoryDb({ user, channelId });

            return true;
        }

        const inRegService = await this._askRegService({ user });

        if (!inRegService) {
            return false;
        }

        // in reg service -> add to mongo and to in-mem
        await Whitelist.create({ user });
        this._addInMemoryDb({ user, channelId });

        return true;
    }

    async banUser(user) {
        await Whitelist.findOneAndRemove({ user });

        this._removeFromMemoryDb(user);
    }
}

module.exports = WhitelistController;
