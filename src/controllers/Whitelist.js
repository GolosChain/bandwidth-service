const core = require('gls-core-service');
const BasicController = core.controllers.Basic;
const Whitelist = require('../model/Whitelist');

class WhitelistController extends BasicController {
    constructor({ connector }) {
        super({ connector });

        this._whitelistMap = new Map(); // username -> set of cids
        this._cidSet = new Set(); // set of cids
    }

    async _askRegService({ username }) {
        // TODO: implement call to service
        return true;
    }

    _addInMem({ username, channelId }) {
        this._cidSet.add(channelId);

        let userCids = this._whitelistMap.get(username);

        if (userCids) {
            userCids.add(channelId);
        } else {
            userCids = new Set(channelId);
        }

        this._whitelistMap.set(username, userCids);
    }

    _removeFromMem(username) {
        const cids = this._whitelistMap.get(username);
        if (cids) {
            cids.forEach(cid => {
                this._cidSet.delete(cid);
            });
        }
    }

    async isAllowed({ channelId, username }) {
        // in memory -> allowed
        if (this._cidSet.has(channelId)) return true;

        const user = await Whitelist.findOne({ username });

        // explicitly banned -> not allowed
        if (user && user.banned) {
            return false;
        }

        // in db -> allowed and should be stored in memory
        if (user && !user.banned) {
            this._addInMem({ username, channelId });

            return true;
        }

        const inRegService = await this._askRegService({ username });

        if (!inRegService) {
            return false;
        }

        // in reg service -> add to mongo and to in-mem
        await Whitelist.create({ username });
        this._addInMem({ username, channelId });

        return true;
    }

    async banUser(username) {
        await Whitelist.findOneAndRemove({ username });

        this._removeFromMem(username);
    }
}

module.exports = WhitelistController;
