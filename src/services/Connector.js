const core = require('gls-core-service');
const BasicConnector = core.services.Connector;
const BandwidthProvider = require('./BandwidthProvider');
const StorageService = require('./StorageService');
const Whitelist = require('../controllers/Whitelist');

class Connector extends BasicConnector {
    constructor() {
        super();
        this._storageService = new StorageService();
        this._whitelistController = new Whitelist({
            connector: this,
            storage: this._storageService,
        });
        this._bandwidthProvider = new BandwidthProvider({
            whitelist: this._whitelistController,
        });
    }

    async start() {
        const storage = this._storageService;
        const provider = this._bandwidthProvider;
        const whitelist = this._whitelistController;

        await provider.start();
        await storage.start();

        this.on('open', data => {
            console.log(data);
        });

        await super.start({
            serverRoutes: {
                'bandwidth.provide': provider.provideBandwidth.bind(provider),
                'bandwidth.banUser': whitelist.banUser.bind(whitelist),
                'bandwidth.notifyOffline': whitelist.handleOffline.bind(whitelist),
            },
        });
    }
}

module.exports = Connector;
