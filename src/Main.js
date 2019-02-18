const core = require('gls-core-service');
const stats = core.utils.statsClient;
const BasicMain = core.services.BasicMain;
const env = require('./data/env');
const Connector = require('./services/Connector');
const MongoDB = core.services.MongoDB;

class Main extends BasicMain {
    constructor() {
        super(stats, env);
        this.addNested(new Connector(), new MongoDB());
    }
}

module.exports = Main;
