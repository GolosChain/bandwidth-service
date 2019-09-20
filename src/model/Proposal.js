const core = require('gls-core-service');
const MongoDB = core.services.MongoDB;

module.exports = MongoDB.makeModel(
    'Proposal',
    {
        initiatorId: {
            type: String,
            required: true,
        },
        waitingFor: {
            type: {
                userId: {
                    type: String,
                    required: true,
                },
                permission: {
                    type: String,
                    required: true,
                },
            },
        },
        action: {
            type: String,
            required: true,
        },
        serializedTransaction: {
            type: String,
            required: true,
        },
        signatures: [
            {
                type: String,
            },
        ],
        expirationTime: {
            type: Date,
            required: true,
        },
    },
    {
        index: [
            {
                fields: {
                    'waitingFor.userId': 1,
                },
            },
            {
                fields: {
                    expirationTime: 1,
                },
            },
        ],
    }
);
