const core = require('gls-core-service');
const BasicConnector = core.services.Connector;
const BandwidthProvider = require('../controllers/BandwidthProvider');
const Whitelist = require('../controllers/Whitelist');

class Connector extends BasicConnector {
    constructor() {
        super();
        this._whitelistController = new Whitelist({ connector: this });
        this._bandwidthProvider = new BandwidthProvider({
            connector: this,
            whitelist: this._whitelistController,
        });
    }

    async start() {
        const provider = this._bandwidthProvider;
        const whitelist = this._whitelistController;

        await super.start({
            serverRoutes: {
                'bandwidth.provide': provider.provideBandwidth.bind(provider),
                'bandwidth.banUser': whitelist.banUser.bind(provider),
            },
        });
    }
}

module.exports = Connector;
