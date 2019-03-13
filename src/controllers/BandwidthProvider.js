const { TextEncoder, TextDecoder } = require('text-encoding');
const core = require('gls-core-service');
const fetch = require('node-fetch');
const { JsonRpc, Api } = require('cyberwayjs');
const JsSignatureProvider = require('cyberwayjs/dist/eosjs-jssig').default;
const BasicController = core.controllers.Basic;
const Logger = core.utils.Logger;
const env = require('../data/env');
const Log = require('../utils/Log');
const {
    CMN_PROVIDER_WIF,
    CMN_PROVIDER_PUBLIC_KEY,
    CMN_PROVIDER_USERNAME,
    CMN_CYBERWAY_HTTP_URL,
} = env;

const rpc = new JsonRpc(CMN_CYBERWAY_HTTP_URL, { fetch });

const requiredKeys = [CMN_PROVIDER_PUBLIC_KEY];
const signatureProviderBP = new JsSignatureProvider([CMN_PROVIDER_WIF]);

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
        transaction.serializedTransaction = Uint8Array.from(transaction.serializedTransaction);

        const deserializedTransaction = await api.deserializeTransactionWithActions(
            transaction.serializedTransaction
        );
        const shouldProvideBandwidth = Boolean(
            deserializedTransaction.actions.find(action => {
                return (
                    action.name === 'providebw' && action.data.provider === CMN_PROVIDER_USERNAME
                );
            })
        );

        let transactionToSend = transaction;

        if (shouldProvideBandwidth) {
            const isAllowed = await this._whitelist.isAllowed({ channelId, user });

            if (!isAllowed) {
                throw {
                    code: 1103,
                    message: 'This user is not allowed to require bandwidth',
                };
            }

            transactionToSend = await this._signTransaction({ transaction, chainId });
        }

        this._logger.createEntry({
            transaction: deserializedTransaction,
            user,
            providedBandwidth: shouldProvideBandwidth,
        });

        return await this._sendTransaction(transactionToSend);
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
