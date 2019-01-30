const core = require('gls-core-service');
const BasicConnector = core.services.Connector;
const BandwidthProvider = require('../controllers/BandwidthProvider');

class Connector extends BasicConnector {
    constructor() {
        super();

        this._bandwidthProvider = new BandwidthProvider({ connector: this });
    }

    async start() {
        const provider = this._bandwidthProvider;

        await super.start({
            serverRoutes: {
                'bandwidth.Provide': provider.provideBandwidth.bind(provider),
            },
        });
    }
}

module.exports = Connector;
