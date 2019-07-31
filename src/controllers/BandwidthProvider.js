const { TextEncoder, TextDecoder } = require('text-encoding');
const core = require('gls-core-service');
const fetch = require('node-fetch');
const { JsonRpc, Api, Serialize } = require('cyberwayjs');
const JsSignatureProvider = require('cyberwayjs/dist/eosjs-jssig').default;
const BasicController = core.controllers.Basic;
const Logger = core.utils.Logger;
const env = require('../data/env');
const Log = require('../utils/Log');
const {
    GLS_PROVIDER_WIF,
    GLS_PROVIDER_PUBLIC_KEY,
    GLS_PROVIDER_USERNAME,
    GLS_CYBERWAY_HTTP_URL,
} = env;

const rpc = new JsonRpc(GLS_CYBERWAY_HTTP_URL, { fetch });

const requiredKeys = [GLS_PROVIDER_PUBLIC_KEY];
const signatureProviderBP = new JsSignatureProvider([GLS_PROVIDER_WIF]);

const api = new Api({
    rpc,
    signatureProviderBP,
    textDecoder: new TextDecoder(),
    textEncoder: new TextEncoder(),
});

class BandwidthProvider extends BasicController {
    constructor({ whitelist }) {
        super();

        this._whitelist = whitelist;
        this._logger = new Log();
    }

    async provideBandwidth({
        routing: { channelId },
        auth: { user },
        params: { transaction, chainId },
    }) {
        try {
            transaction.serializedTransaction = Serialize.hexToUint8Array(
                transaction.serializedTransaction
            );
        } catch (error) {
            Logger.error('Uind8Array error --', JSON.stringify(error, null, 4));
            throw error;
        }
        let deserializedTransaction;
        try {
            deserializedTransaction = await api.deserializeTransactionWithActions(
                transaction.serializedTransaction
            );
        } catch (error) {
            Logger.error('Transaction deserialization error --', JSON.stringify(error, null, 4));
            throw error;
        }
        const shouldProvideBandwidth = Boolean(
            deserializedTransaction.actions.find(action => {
                return (
                    action.name === 'providebw' && action.data.provider === GLS_PROVIDER_USERNAME
                );
            })
        );

        let transactionToSend = transaction;

        if (shouldProvideBandwidth) {
            let isAllowed = false;
            try {
                isAllowed = await this._whitelist.isAllowed({ channelId, user });
            } catch (error) {
                Logger.error('Whitelist check error --', JSON.stringify(error, null, 4));
                throw error;
            }

            if (!isAllowed) {
                throw {
                    code: 1103,
                    message: 'This user is not allowed to require bandwidth',
                };
            }

            try {
                transactionToSend = await this._signTransaction({ transaction, chainId });
            } catch (error) {
                Logger.error('Transaction sign error --', JSON.stringify(error, null, 4));
                throw error;
            }
        }

        try {
            this._logger.createEntry({
                transaction: deserializedTransaction,
                user,
                providedBandwidth: shouldProvideBandwidth,
            });
        } catch (error) {
            Logger.error('Logger entry creation error --', JSON.stringify(error, null, 4));
        }

        try {
            return await this._sendTransaction(transactionToSend);
        } catch (error) {
            Logger.error('Transaction send error --', JSON.stringify(error, null, 4));
            throw error;
        }
    }

    async _signTransaction({ transaction, chainId }) {
        const transactionBW = await signatureProviderBP.sign({
            chainId,
            requiredKeys,
            serializedTransaction: transaction.serializedTransaction,
        });

        const transactionBoth = {
            ...transaction,
            signatures: [...transaction.signatures, ...transactionBW.signatures],
            serializedTransaction: transaction.serializedTransaction,
        };

        const { signatures, serializedTransaction } = transactionBoth;

        return { signatures, serializedTransaction };
    }

    async _sendTransaction({ signatures, serializedTransaction }) {
        try {
            return await api.pushSignedTransaction({
                signatures,
                serializedTransaction,
            });
        } catch (error) {
            Logger.error(error.json);
            throw error.json;
        }
    }
}

module.exports = BandwidthProvider;
