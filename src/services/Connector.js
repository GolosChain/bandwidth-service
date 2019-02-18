const core = require('gls-core-service');
const BasicConnector = core.services.Connector;
const BandwidthProvider = require('../controllers/BandwidthProvider');
const StorageService = require('./StorageService');
const Whitelist = require('../controllers/Whitelist');
const env = require('../data/env');

class Connector extends BasicConnector {
    constructor() {
        super();
        this._storageService = new StorageService();
        this.addNested(this._storageService);
        this._whitelistController = new Whitelist({
            connector: this,
            storage: this._storageService,
        });
        this._bandwidthProvider = new BandwidthProvider({
            whitelist: this._whitelistController,
        });
    }

    async start() {
        const provider = this._bandwidthProvider;
        const whitelist = this._whitelistController;

        await super.start({
            serverRoutes: {
                'bandwidth.provide': provider.provideBandwidth.bind(provider),
                'bandwidth.banUser': whitelist.banUser.bind(whitelist),
                'bandwidth.notifyOffline': whitelist.handleOffline.bind(whitelist),
            },
            requiredClients: {
                registration: env.CMN_REGISTRATION_CONNECT,
            },
        });

        await this.startNested();
    }
}

module.exports = Connector;
