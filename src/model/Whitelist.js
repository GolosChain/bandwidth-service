const core = require('gls-core-service');
const MongoDB = core.services.MongoDB;

module.exports = MongoDB.makeModel('Whitelist', {
    username: {
        type: String,
        required: true,
    },
    banned: {
        type: Boolean,
        required: true,
        default: false,
    },
});
